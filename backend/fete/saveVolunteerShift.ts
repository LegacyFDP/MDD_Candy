const VOLUNTEER_ROLES = [
  'Lead Volunteer',
  'Helper',
  'Putting Up',
  'Taking Down',
  'Transport',
  'Stall Holder',
] as const

type Params = {
  id?: number
  volunteer_id: number
  fete_id?: number | null
  role?: string
  start_date?: string
  end_date?: string
  shift_date?: string
  start_time: string
  end_time: string
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
    role = 'Helper',
    start_date,
    end_date,
    shift_date,
    start_time,
    end_time,
  } = req.params

  const actualStartDate = start_date ?? shift_date
  const actualEndDate = end_date ?? shift_date ?? start_date

  if (!volunteer_id) throw new Error('Volunteer is required')
  if (!actualStartDate) throw new Error('Shift start date is required')
  if (!actualEndDate) throw new Error('Shift end date is required')
  if (!isValidTime(start_time) || !isValidTime(end_time)) {
    throw new Error('Shift times must be in HH:MM format')
  }

  if (!VOLUNTEER_ROLES.includes(role as typeof VOLUNTEER_ROLES[number])) {
    throw new Error(`Volunteer role must be one of: ${VOLUNTEER_ROLES.join(', ')}`)
  }

  const startMinutes = toMinutes(start_time)
  const endMinutes = toMinutes(end_time)

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

  if (id) {
    await retoolDb.query(`
      UPDATE volunteer_shifts
      SET volunteer_id=$1,
          fete_id=$2,
          role=$3,
          start_date=$4,
          end_date=$5,
          start_time=$6,
          end_time=$7
      WHERE id=$8
    `, [volunteer_id, fete_id ?? null, role, actualStartDate, actualEndDate, start_time, end_time, id])
  } else {
    await retoolDb.query(`
      INSERT INTO volunteer_shifts (volunteer_id, fete_id, role, start_date, end_date, start_time, end_time)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [volunteer_id, fete_id ?? null, role, actualStartDate, actualEndDate, start_time, end_time])
  }

  return { success: true }
}
