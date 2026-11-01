type Params = { id: number }

export default async function (req: { params: Params; user: User }) {
  const { id } = req.params
  if (!Number.isInteger(id) || id <= 0) throw new Error('A valid fete id is required')

  await retoolDb.query(`
    DELETE FROM volunteer_shift_roles
    WHERE shift_id IN (SELECT id FROM volunteer_shifts WHERE fete_id = $1)
  `, [id])
  await retoolDb.query('DELETE FROM volunteer_shifts WHERE fete_id = $1', [id])
  await retoolDb.query('DELETE FROM fete_contact_events WHERE fete_id = $1', [id])
  await retoolDb.query('DELETE FROM fete_requirements WHERE fete_id = $1', [id])
  await retoolDb.query('UPDATE withdrawals SET fete_id = NULL WHERE fete_id = $1', [id])
  await retoolDb.query('DELETE FROM fetes WHERE id = $1', [id])

  return { success: true }
}