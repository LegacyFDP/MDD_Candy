type Params = { id: number }

export default async function (req: { params: Params; user: User }) {
  const { id } = req.params

  // Block deletion if the user has any withdrawal records (withdrawn_by is NOT NULL FK)
  const wCheck = await retoolDb.query<{ cnt: number }>(
    `SELECT COUNT(*)::int AS cnt FROM withdrawals WHERE withdrawn_by = $1 OR returned_by = $2`,
    [id, id]
  )
  if ((wCheck.data[0]?.cnt ?? 0) > 0) {
    throw new Error('Cannot delete this user — they have withdrawal records. Reassign or archive those first.')
  }

  // Nullify fetes they created (created_by is nullable)
  await retoolDb.query(`UPDATE fetes SET created_by = NULL WHERE created_by = $1`, [id])

  await retoolDb.query(`DELETE FROM fete_users WHERE id = $1`, [id])
  return { success: true }
}
