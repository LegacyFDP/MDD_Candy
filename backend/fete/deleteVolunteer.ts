import { requireAdmin } from './_auth'

type Params = { id: number }

export default async function (req: { params: Params; user: User }) {
  requireAdmin(req.user)

  const { id } = req.params

  await retoolDb.query('DELETE FROM volunteers WHERE id = $1', [id])
  return { success: true }
}
