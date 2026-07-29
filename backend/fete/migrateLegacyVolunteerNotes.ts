import { requireAdmin } from './_auth'

type Params = {
  dry_run?: boolean
  include_details?: boolean
  detail_limit?: number
}

type AssignmentRow = {
  assignment_id: number
  fete_date: string | null
  assignment_notes: string
  legacy_notes: string
}

function pad2(value: number): string {
  return String(value).padStart(2, '0')
}

function toIsoDateFromUk(day: number, month: number, year: number): string {
  return `${year}-${pad2(month)}-${pad2(day)}`
}

function normalizeHour(rawHour: number, suffix?: string): number | null {
  if (!Number.isInteger(rawHour)) return null
  const lower = (suffix ?? '').toLowerCase()

  if (!lower) {
    if (rawHour >= 0 && rawHour <= 23) return rawHour
    return null
  }

  if (rawHour < 1 || rawHour > 12) return null
  if (lower === 'am') return rawHour === 12 ? 0 : rawHour
  if (lower === 'pm') return rawHour === 12 ? 12 : rawHour + 12
  return null
}

function parseDates(noteText: string, fallbackDate: string | null): string[] {
  const result = new Set<string>()

  const isoMatches = noteText.matchAll(/\b(\d{4})-(\d{2})-(\d{2})\b/g)
  for (const match of isoMatches) {
    result.add(`${match[1]}-${match[2]}-${match[3]}`)
  }

  const ukMatches = noteText.matchAll(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g)
  for (const match of ukMatches) {
    const day = Number(match[1])
    const month = Number(match[2])
    const year = Number(match[3])
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      result.add(toIsoDateFromUk(day, month, year))
    }
  }

  if (result.size === 0 && fallbackDate) {
    const dateOnly = fallbackDate.includes('T') ? fallbackDate.split('T')[0] : fallbackDate
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) {
      result.add(dateOnly)
    }
  }

  return Array.from(result).sort()
}

function parseHours(noteText: string): number[] {
  const starts = new Set<number>()
  const text = noteText.toLowerCase()

  if (/(all day|full day)/i.test(text)) {
    for (let hour = 9; hour <= 17; hour += 1) starts.add(hour)
  }

  const rangeRegex = /(\b\d{1,2})(?::00)?\s*(am|pm)?\s*(?:to|-|until)\s*(\d{1,2})(?::00)?\s*(am|pm)?/gi
  for (const match of text.matchAll(rangeRegex)) {
    const fromRaw = Number(match[1])
    const fromSuffix = match[2] ?? ''
    const toRaw = Number(match[3])
    const toSuffix = match[4] || fromSuffix

    const fromHour = normalizeHour(fromRaw, fromSuffix)
    const toHour = normalizeHour(toRaw, toSuffix)
    if (fromHour == null || toHour == null) continue
    if (toHour <= fromHour) continue

    for (let hour = fromHour; hour < toHour; hour += 1) {
      if (hour >= 9 && hour <= 17) starts.add(hour)
    }
  }

  const amPmRegex = /\b(\d{1,2})(?::00)?\s*(am|pm)\b/gi
  for (const match of text.matchAll(amPmRegex)) {
    const hour = normalizeHour(Number(match[1]), match[2])
    if (hour != null && hour >= 9 && hour <= 17) starts.add(hour)
  }

  const twentyFourHourRegex = /\b([01]?\d|2[0-3]):00\b/g
  for (const match of text.matchAll(twentyFourHourRegex)) {
    const hour = Number(match[1])
    if (hour >= 9 && hour <= 17) starts.add(hour)
  }

  return Array.from(starts).sort((a, b) => a - b)
}

function isConsecutive(days: string[]): boolean {
  if (days.length <= 1) return true
  for (let i = 1; i < days.length; i += 1) {
    const prev = new Date(`${days[i - 1]}T00:00:00Z`).getTime()
    const curr = new Date(`${days[i]}T00:00:00Z`).getTime()
    if ((curr - prev) / 86400000 !== 1) return false
  }
  return true
}

export default async function (req: { params: Params; user: User }) {
  requireAdmin(req.user)

  const dryRun = req.params.dry_run !== false
  const includeDetails = req.params.include_details === true
  const detailLimit = Math.min(Math.max(Number(req.params.detail_limit ?? 1000), 1), 10000)

  const rows = await retoolDb.query<AssignmentRow>(
    `
      SELECT
        a.id AS assignment_id,
        f.event_date AS fete_date,
        COALESCE(a.notes, '') AS assignment_notes,
        COALESCE(fv.notes, '') AS legacy_notes
      FROM fete_volunteer_assignments a
      LEFT JOIN fetes f ON f.id = a.fete_id
      LEFT JOIN fete_volunteers fv ON fv.id = a.legacy_fete_volunteer_id
      WHERE NOT EXISTS (
        SELECT 1
        FROM fete_volunteer_availability av
        WHERE av.assignment_id = a.id
      )
      ORDER BY a.id ASC
    `,
  )

  let scannedAssignments = 0
  let assignmentsWithNoNotes = 0
  let assignmentsWithNoHourMatch = 0
  let assignmentsWithInvalidDays = 0
  let assignmentsEligible = 0
  let insertedSlots = 0

  const samples: Array<{
    assignment_id: number
    dates: string[]
    start_hours: number[]
    slots: number
  }> = []

  const details: Array<{
    assignment_id: number
    status: 'eligible' | 'no_notes' | 'no_hour_match' | 'invalid_days'
    source: 'assignment_notes' | 'legacy_notes' | 'none'
    date_count: number
    dates: string[]
    start_hours: number[]
    slots: number
    note: string
  }> = []

  for (const row of rows.data) {
    scannedAssignments += 1

    const assignmentText = (row.assignment_notes || '').trim()
    const legacyText = (row.legacy_notes || '').trim()
    const noteText = assignmentText || legacyText
    const noteSource: 'assignment_notes' | 'legacy_notes' | 'none' = assignmentText
      ? 'assignment_notes'
      : legacyText
        ? 'legacy_notes'
        : 'none'

    if (!noteText) {
      assignmentsWithNoNotes += 1
      if (includeDetails && details.length < detailLimit) {
        details.push({
          assignment_id: row.assignment_id,
          status: 'no_notes',
          source: noteSource,
          date_count: 0,
          dates: [],
          start_hours: [],
          slots: 0,
          note: '',
        })
      }
      continue
    }

    const dates = parseDates(noteText, row.fete_date)
    if (dates.length === 0 || dates.length > 3 || !isConsecutive(dates)) {
      assignmentsWithInvalidDays += 1
      if (includeDetails && details.length < detailLimit) {
        details.push({
          assignment_id: row.assignment_id,
          status: 'invalid_days',
          source: noteSource,
          date_count: dates.length,
          dates,
          start_hours: [],
          slots: 0,
          note: noteText,
        })
      }
      continue
    }

    const startHours = parseHours(noteText)
    if (startHours.length === 0) {
      assignmentsWithNoHourMatch += 1
      if (includeDetails && details.length < detailLimit) {
        details.push({
          assignment_id: row.assignment_id,
          status: 'no_hour_match',
          source: noteSource,
          date_count: dates.length,
          dates,
          start_hours: [],
          slots: 0,
          note: noteText,
        })
      }
      continue
    }

    assignmentsEligible += 1
    const slotsForAssignment = dates.length * startHours.length

    if (samples.length < 10) {
      samples.push({
        assignment_id: row.assignment_id,
        dates,
        start_hours: startHours,
        slots: slotsForAssignment,
      })
    }

    if (includeDetails && details.length < detailLimit) {
      details.push({
        assignment_id: row.assignment_id,
        status: 'eligible',
        source: noteSource,
        date_count: dates.length,
        dates,
        start_hours: startHours,
        slots: slotsForAssignment,
        note: noteText,
      })
    }

    if (dryRun) {
      insertedSlots += slotsForAssignment
      continue
    }

    for (const date of dates) {
      for (const startHour of startHours) {
        await retoolDb.query(
          `
            INSERT OR IGNORE INTO fete_volunteer_availability (
              assignment_id,
              slot_date,
              start_hour,
              end_hour
            )
            VALUES ($1, $2, $3, $4)
          `,
          [row.assignment_id, date, startHour, startHour + 1],
        )
        insertedSlots += 1
      }
    }
  }

  return {
    success: true,
    dry_run: dryRun,
    include_details: includeDetails,
    detail_limit: detailLimit,
    scanned_assignments: scannedAssignments,
    assignments_eligible: assignmentsEligible,
    assignments_with_no_notes: assignmentsWithNoNotes,
    assignments_with_no_hour_match: assignmentsWithNoHourMatch,
    assignments_with_invalid_days: assignmentsWithInvalidDays,
    slots_planned_or_inserted: insertedSlots,
    sample: samples,
    details,
  }
}
