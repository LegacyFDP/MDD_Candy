export default async function (_req: { params: Record<string, never>; user: User }) {
  const assignments = await retoolDb.query<{
    id: number
    fete_id: number
    volunteer_id: number
    user_name: string
    email: string
    role_key: string
    role_other: string
    notes: string
    added_at: string
  }>(`
    SELECT
      a.id,
      a.fete_id,
      a.volunteer_id,
      v.name AS user_name,
      v.email,
      a.role_key,
      a.role_other,
      a.notes,
      a.created_at AS added_at
    FROM fete_volunteer_assignments a
    JOIN volunteers v ON v.id = a.volunteer_id
    ORDER BY a.fete_id, v.name ASC
  `)

  const slots = await retoolDb.query<{
    assignment_id: number
    slot_date: string
    start_hour: number
    end_hour: number
  }>(`
    SELECT assignment_id, slot_date, start_hour, end_hour
    FROM fete_volunteer_availability
    ORDER BY slot_date ASC, start_hour ASC
  `)

  const slotsByAssignment = new Map<number, Array<{ date: string; start_hour: number; end_hour: number }>>()
  for (const slot of slots.data) {
    if (!slotsByAssignment.has(slot.assignment_id)) {
      slotsByAssignment.set(slot.assignment_id, [])
    }
    slotsByAssignment.get(slot.assignment_id)!.push({
      date: slot.slot_date,
      start_hour: slot.start_hour,
      end_hour: slot.end_hour,
    })
  }

  const normalized = assignments.data.map((row) => ({
    id: row.id,
    fete_id: row.fete_id,
    volunteer_id: row.volunteer_id,
    user_id: row.volunteer_id,
    user_name: row.user_name,
    email: row.email,
    user_role: 'volunteer',
    role_key: row.role_key,
    role_other: row.role_other,
    role: row.role_key === 'Other' && row.role_other ? row.role_other : row.role_key,
    notes: row.notes,
    added_at: row.added_at,
    availability: slotsByAssignment.get(row.id) ?? [],
  }))

  if (normalized.length > 0) {
    return normalized
  }

  // Compatibility fallback for databases not yet migrated.
  const legacy = await retoolDb.query(`
    SELECT fv.id, fv.fete_id, fv.role, fv.notes, fv.added_at,
           u.id   AS user_id,
           u.name AS user_name,
           u.email,
           u.role AS user_role
    FROM fete_volunteers fv
    JOIN fete_users u ON fv.user_id = u.id
    ORDER BY fv.fete_id, u.name ASC
  `)

  return (legacy.data as Array<{
    id: number
    fete_id: number
    user_id: number
    user_name: string
    email: string
    user_role: string
    role: string
    notes: string
    added_at: string
  }>).map((row) => ({
    ...row,
    volunteer_id: row.user_id,
    role_key: 'Other',
    role_other: row.role,
    availability: [],
  }))
}
