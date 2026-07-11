type Params = {
  withdrawal_id: number
  returned_by: number
  notes: string
}

export default async function (req: { params: Params; user: User }) {
  const { withdrawal_id, returned_by, notes } = req.params

  // Get the withdrawal
  const check = await retoolDb.query<{ asset_id: number; quantity: number; status: string }>(
    `SELECT asset_id, quantity, status FROM withdrawals WHERE id = $1`, [withdrawal_id]
  )
  const w = check.data[0]
  if (!w) throw new Error('Withdrawal not found')
  if (w.status === 'returned') throw new Error('Item already returned')

  // Mark as returned
  await retoolDb.query(`
    UPDATE withdrawals
    SET status = 'returned', returned_at = NOW(), returned_by = $1, notes = COALESCE(NULLIF(notes,''), '') || $2
    WHERE id = $3
  `, [returned_by, notes ? (' | Return note: ' + notes) : '', withdrawal_id])

  // Add quantity back to available
  await retoolDb.query(`
    UPDATE assets SET quantity_available = quantity_available + $1 WHERE id = $2
  `, [w.quantity, w.asset_id])

  return { success: true }
}
