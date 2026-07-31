import { requireAdmin } from './_auth'
import { normalizeRole } from './_volunteerScheduling'

type Params = {
  id?: number
  fete_id: number
  volunteer_id?: number
  user_id?: number
  role: string
  role_other?: string
  notes: string
}

export default async function (req: { params: Params; user: User }) {
  requireAdmin(req.user)

  const { id, fete_id, role, notes } = req.params
  const volunteerId = Number(req.params.volunteer_id ?? req.params.user_id)
  const { roleKey, roleOther } = normalizeRole(req.params.role, req.params.role_other)

  if (!Number.isInteger(fete_id) || fete_id <= 0) {
    throw new Error('Valid fete_id is required')
  }

  if (!Number.isInteger(volunteerId) || volunteerId <= 0) {
    throw new Error('Valid volunteer_id is required')
  }

  if (id) {
    const existing = await retoolDb.query<{ id: number }>(
      'SELECT id FROM fete_volunteer_assignments WHERE id = $1',
      [id],
    )
    if (existing.data.length === 0) {
      throw new Error('Volunteer assignment not found')
    }

    await retoolDb.query(
      `
        UPDATE fete_volunteer_assignments
        SET role_key = $1,
            role_other = $2,
            notes = $3,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $4
      `,
      [roleKey, roleOther, (notes ?? '').trim(), id],
    )
  } else {
    await retoolDb.query(
      `
        INSERT INTO fete_volunteer_assignments (
          fete_id,
          volunteer_id,
          role_key,
          role_other,
          notes,
          added_by_user_id
        )
        VALUES ($1, $2, $3, $4, $5, $6)
      `,
      [fete_id, volunteerId, roleKey, roleOther, (notes ?? '').trim(), req.user.id],
    )

    const inserted = await retoolDb.query<{ id: number }>('SELECT last_insert_rowid() AS id')
    const assignmentId = inserted.data[0]?.id
    if (!assignmentId) {
      throw new Error('Failed to create volunteer assignment')
    }
  }

  return { success: true }
}
