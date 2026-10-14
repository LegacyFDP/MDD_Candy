type Params = { id: number }

export default async function (req: { params: Params; user: User }) {
  const { id } = req.params
  const activeCheck = await retoolDb.query<{ count: number }>(
    `SELECT COUNT(*) AS count FROM withdrawals WHERE asset_id = $1 AND status IN ('out', 'booked')`,
    [id],
  )
  if ((activeCheck.data[0]?.count ?? 0) > 0) {
    throw new Error('Cannot delete an asset that is currently checked out or booked')
  }

  await retoolDb.query(`DELETE FROM assets WHERE id = $1`, [id])
  return { success: true }
}

