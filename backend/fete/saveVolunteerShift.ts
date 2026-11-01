const VOLUNTEER_ROLES = [
  'Lead Volunteer',
  'Helper',
  'Putting Up',
  'Taking Down',
  'Transport',
  'Stall Holder',
] as const

type ShiftItem = {
  id?: number
  start_date?: string
  end_date?: string
  shift_date?: string
  start_time: string
  end_time: string
}

type DaySchedule = {
  date: string
  slots: Array<{ start_time: string; end_time: string }>
}

type Params = {
  id?: number
  volunteer_id: number // the volunteer's person id
  fete_id?: number | null
  roles?: string[]
  start_date?: string
  end_date?: string
  shift_date?: string
  start_time?: string
  end_time?: string
  shifts?: ShiftItem[]
  days?: DaySchedule[]
}

function isValidTime(value: string): boolean {
  return /^\d{2}:\d{2}$/.test(value)
}

function toMinutes(value: string): number {
  return Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5))
}

export default async function (req: { params: Params; user: User }) {
  const {
    id,
    volunteer_id,
    fete_id,
    roles = [],
    start_date,
    end_date,
    shift_date,
    start_time,
    end_time,
    shifts,
    days,
  } = req.params

  if (!volunteer_id) throw new Error('Volunteer is required')

  const uniqueRoles = [...new Set(roles)]
  if (!uniqueRoles.every(role => VOLUNTEER_ROLES.includes(role as typeof VOLUNTEER_ROLES[number]))) {
    throw new Error(`Event roles must be one of: ${VOLUNTEER_ROLES.join(', ')}`)
  }

  // Normalize shifts from days, shifts array, or individual date/time fields
  const items: ShiftItem[] = []

  if (Array.isArray(days) && days.length > 0) {
    for (const day of days) {
      if (!day || !day.date || !Array.isArray(day.slots)) continue
      for (const slot of day.slots) {
        if (slot && slot.start_time && slot.end_time) {
          items.push({
            start_date: day.date,
            end_date: day.date,
            start_time: slot.start_time,
            end_time: slot.end_time,
          })
        }
      }
    }
  } else if (Array.isArray(shifts) && shifts.length > 0) {
    items.push(...shifts)
  } else if (start_date || shift_date) {
    items.push({
      id,
      start_date,
      end_date,
      shift_date,
      start_time: start_time ?? '',
      end_time: end_time ?? '',
    })
  }

  if (items.length === 0) {
    throw new Error('At least one time slot must be allocated')
  }

  // Validate each shift item
  for (const item of items) {
    const actualStartDate = item.start_date ?? item.shift_date
    const actualEndDate = item.end_date ?? item.shift_date ?? item.start_date

    if (!actualStartDate) throw new Error('Shift start date is required')
    if (!actualEndDate) throw new Error('Shift end date is required')
    if (!isValidTime(item.start_time) || !isValidTime(item.end_time)) {
      throw new Error('Shift times must be in HH:MM format')
    }

    const startMinutes = toMinutes(item.start_time)
    const endMinutes = toMinutes(item.end_time)

    if (startMinutes < 9 * 60 || endMinutes > 18 * 60 || startMinutes >= 18 * 60) {
      throw new Error('Shift times must stay between 09:00 and 18:00')
    }

    if (endMinutes <= startMinutes || (endMinutes - startMinutes) % 60 !== 0) {
      throw new Error('Shift blocks must be 1-hour increments between 09:00 and 18:00')
    }

    const startMs = new Date(`${actualStartDate}T00:00:00`).getTime()
    const endMs = new Date(`${actualEndDate}T00:00:00`).getTime()
    const dayDiff = Math.round((endMs - startMs) / 86400000)

    if (dayDiff < 0 || dayDiff > 2) {
      throw new Error('Volunteer shifts can span up to 3 consecutive days')
    }
  }

  if (fete_id != null) {
    const fete = await retoolDb.query<{ event_date: string }>(
      'SELECT event_date FROM fetes WHERE id = $1',
      [fete_id],
    )
    const eventDate = fete.data[0]?.event_date

    if (!eventDate) throw new Error('Selected event was not found')

    const earliestDate = new Date(`${eventDate}T00:00:00`)
    earliestDate.setDate(earliestDate.getDate() - 1)
    const latestDate = new Date(`${eventDate}T00:00:00`)
    latestDate.setDate(latestDate.getDate() + 1)

    for (const item of items) {
      const actualStartDate = item.start_date ?? item.shift_date!
      const actualEndDate = item.end_date ?? item.shift_date ?? item.start_date!
      const startMs = new Date(`${actualStartDate}T00:00:00`).getTime()
      const endMs = new Date(`${actualEndDate}T00:00:00`).getTime()

      if (startMs < earliestDate.getTime() || endMs > latestDate.getTime()) {
        throw new Error('Volunteer shifts must be between one day before and one day after the event date')
      }
    }
  }

  if (items.length === 1 && (items[0].id || id)) {
    const targetId = items[0].id ?? id
    const item = items[0]
    const actualStartDate = item.start_date ?? item.shift_date!
    const actualEndDate = item.end_date ?? item.shift_date ?? item.start_date!

    await retoolDb.query(`
      UPDATE volunteer_shifts
      SET person_id=$1,
          fete_id=$2,
          start_date=$3,
          end_date=$4,
          start_time=$5,
          end_time=$6
      WHERE id=$7
    `, [volunteer_id, fete_id ?? null, actualStartDate, actualEndDate, item.start_time, item.end_time, targetId])

    await retoolDb.query('DELETE FROM volunteer_shift_roles WHERE shift_id = $1', [targetId])
    for (const role of uniqueRoles) {
      await retoolDb.query('INSERT INTO volunteer_shift_roles (shift_id, role) VALUES ($1, $2)', [targetId, role])
    }
    return { success: true, count: 1 }
  }

  for (const item of items) {
    const actualStartDate = item.start_date ?? item.shift_date!
    const actualEndDate = item.end_date ?? item.shift_date ?? item.start_date!

    const created = await retoolDb.query<{ id: number }>(`
      INSERT INTO volunteer_shifts (person_id, fete_id, start_date, end_date, start_time, end_time)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `, [volunteer_id, fete_id ?? null, actualStartDate, actualEndDate, item.start_time, item.end_time])

    const shiftId = created.data[0]?.id
    if (shiftId) {
      for (const role of uniqueRoles) {
        await retoolDb.query('INSERT INTO volunteer_shift_roles (shift_id, role) VALUES ($1, $2)', [shiftId, role])
      }
    }
  }

  return { success: true, count: items.length }
}
