export const FIXED_ROLES = [
  'Lead Volunteer',
  'Helper',
  'Putting Up',
  'Taking Down',
  'Transport',
  'Stall Holder',
] as const

export type FixedRole = (typeof FIXED_ROLES)[number]

export type AvailabilitySlot = {
  date: string
  start_hour: number
  end_hour: number
}

function normalizeDateString(dateText: string): string {
  const trimmed = dateText.trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    throw new Error('Availability date must be in YYYY-MM-DD format')
  }
  return trimmed
}

function toUtcDayNumber(dateText: string): number {
  const date = new Date(`${dateText}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid availability date: ${dateText}`)
  }
  return Math.floor(date.getTime() / 86400000)
}

export function normalizeRole(role: string, roleOther?: string): { roleKey: string; roleOther: string } {
  const trimmedRole = (role ?? '').trim()
  const trimmedOther = (roleOther ?? '').trim()

  if (trimmedRole === 'Other') {
    if (!trimmedOther) {
      throw new Error('Provide a custom role when selecting Other')
    }
    return { roleKey: 'Other', roleOther: trimmedOther }
  }

  if (!FIXED_ROLES.includes(trimmedRole as FixedRole)) {
    throw new Error('Role must be one of the supported roles or Other')
  }

  return { roleKey: trimmedRole, roleOther: '' }
}

export function normalizeAvailability(raw: unknown): AvailabilitySlot[] {
  if (!raw) return []
  if (!Array.isArray(raw)) {
    throw new Error('Availability must be an array')
  }

  const slots: AvailabilitySlot[] = raw.map((item) => {
    if (!item || typeof item !== 'object') {
      throw new Error('Each availability slot must be an object')
    }

    const date = normalizeDateString(String((item as { date?: unknown }).date ?? ''))
    const startHour = Number((item as { start_hour?: unknown }).start_hour)
    const endHour = Number((item as { end_hour?: unknown }).end_hour)

    if (!Number.isInteger(startHour) || !Number.isInteger(endHour)) {
      throw new Error('Availability hours must be whole numbers')
    }

    if (startHour < 9 || startHour > 17 || endHour !== startHour + 1 || endHour > 18) {
      throw new Error('Availability slots must be one-hour blocks between 09:00 and 18:00')
    }

    return {
      date,
      start_hour: startHour,
      end_hour: endHour,
    }
  })

  const uniqueDays = Array.from(new Set(slots.map((slot) => slot.date))).sort((a, b) =>
    toUtcDayNumber(a) - toUtcDayNumber(b),
  )

  if (uniqueDays.length > 3) {
    throw new Error('Availability can cover at most 3 days')
  }

  for (let i = 1; i < uniqueDays.length; i += 1) {
    const prevDay = toUtcDayNumber(uniqueDays[i - 1])
    const currentDay = toUtcDayNumber(uniqueDays[i])
    if (currentDay - prevDay !== 1) {
      throw new Error('Availability days must be consecutive')
    }
  }

  const dedupe = new Set<string>()
  for (const slot of slots) {
    const key = `${slot.date}:${slot.start_hour}`
    if (dedupe.has(key)) {
      throw new Error('Duplicate availability slot detected')
    }
    dedupe.add(key)
  }

  return slots
}
