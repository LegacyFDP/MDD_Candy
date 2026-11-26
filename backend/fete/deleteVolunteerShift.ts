type Params = { id: number }

export default async function (req: { params: Params; user: User }) {
  const { id } = req.params
  if (!Number.isInteger(id) || id <= 0) throw new Error('A valid shift id is required')
  // Remove the shift's event roles too, so none are left behind.
  await retoolDb.query('DELETE FROM volunteer_shift_roles WHERE shift_id = $1', [id])
  await retoolDb.query('DELETE FROM volunteer_shifts WHERE id = $1', [id])
  return { success: true }
}
