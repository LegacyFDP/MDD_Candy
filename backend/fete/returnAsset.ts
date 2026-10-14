type Params = {
  withdrawal_id: number
  returned_by: number
  notes: string
}

export default async function (req: { params: Params; user: User }) {
  const { withdrawal_id, returned_by, notes } = req.params

  const userCheck = await retoolDb.query<{ id: number; role: string }>(
    `SELECT id, role FROM fete_users WHERE id = $1`, [returned_by]
  )
  const actingUser = userCheck.data[0]
  if (!actingUser) {
    throw new Error('Returned by user not found')
  }
  if (actingUser.role !== 'admin' && actingUser.role !== 'store keeper') {
    throw new Error('Only admin or store keeper can change asset status')
  }

  // Get the withdrawal
  const check = await retoolDb.query<{ asset_id: number; quantity: number; status: string }>(
    `SELECT asset_id, quantity, status FROM withdrawals WHERE id = $1`, [withdrawal_id]
  )
  const w = check.data[0]
  if (!w) throw new Error('Withdrawal not found')
  if (w.status === 'returned') throw new Error('Item already returned')
  if (w.status !== 'out') throw new Error('Only items currently checked out can be returned')

  const applyReturn = async () => {
    // Mark as returned
    await retoolDb.query(`
      UPDATE withdrawals
      SET status = 'returned', returned_at = CURRENT_TIMESTAMP, returned_by = $1, notes = COALESCE(NULLIF(notes,''), '') || $2
      WHERE id = $3 AND status = 'out'
    `, [returned_by, notes ? (' | Return note: ' + notes) : '', withdrawal_id])

    // Add quantity back to available, capped at quantity_total
    await retoolDb.query(`
      UPDATE assets
      SET quantity_available = MIN(quantity_total, quantity_available + $1)
      WHERE id = $2
    `, [w.quantity, w.asset_id])
  }

  if (retoolDb.transaction) {
    await retoolDb.transaction(applyReturn)
  } else {
    await applyReturn()
  }

  return { success: true }
}
