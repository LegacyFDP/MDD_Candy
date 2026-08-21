type Params = { id: number }

export default async function (req: { params: Params; user: User }) {
  const { id } = req.params
  if (!Number.isInteger(id) || id <= 0) throw new Error('A valid Storage Area id is required')

  await retoolDb.query('DELETE FROM storage_areas WHERE id = $1', [id])
  return { success: true }
}