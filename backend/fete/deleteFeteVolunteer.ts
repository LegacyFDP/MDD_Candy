import { requireAdmin } from './_auth'

type Params = { id: number }

export default async function (req: { params: Params; user: User }) {
  requireAdmin(req.user)

  const { id } = req.params
  const check = await retoolDb.query<{ id: number }>(
    'SELECT id FROM fete_volunteer_assignments WHERE id = $1',
    [id],
  )

  if (check.data.length > 0) {
    await retoolDb.query('DELETE FROM fete_volunteer_assignments WHERE id = $1', [id])
  } else {
    await retoolDb.query('DELETE FROM fete_volunteers WHERE id = $1', [id])
  }

  return { success: true }
}
