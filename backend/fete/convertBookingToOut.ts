type Params = {
  withdrawal_id: number
  withdrawn_by: number
  notes: string
}

export default async function (req: { params: Params; user: User }) {
  const { withdrawal_id, withdrawn_by, notes } = req.params

  const userCheck = await retoolDb.query<{ id: number; role: string }>(
    `SELECT id, role FROM fete_users WHERE id = $1`, [withdrawn_by]
  )
  const actingUser = userCheck.data[0]
  if (!actingUser) {
    throw new Error('Withdrawn by user not found')
  }
  if (actingUser.role !== 'admin' && actingUser.role !== 'store keeper') {
    throw new Error('Only admin or store keeper can change asset status')
  }

  const check = await retoolDb.query<{ asset_id: number; quantity: number; status: string; notes: string }>(
    `SELECT asset_id, quantity, status, notes FROM withdrawals WHERE id = $1`,
    [withdrawal_id],
  )
  const booking = check.data[0]
  if (!booking) throw new Error('Booking not found')
  if (booking.status !== 'booked') throw new Error('Only booked items can be converted to out')

  const assetCheck = await retoolDb.query<{ quantity_available: number }>(
    `SELECT quantity_available FROM assets WHERE id = $1`,
    [booking.asset_id],
  )
  const asset = assetCheck.data[0]
  if (!asset) throw new Error('Asset not found')
  if (asset.quantity_available < booking.quantity) {
    throw new Error(
      `Not enough stock available to convert booking (${asset.quantity_available} in store)`
    )
  }

  await retoolDb.query(
    `UPDATE assets SET quantity_available = quantity_available - $1 WHERE id = $2`,
    [booking.quantity, booking.asset_id],
  )

  await retoolDb.query(
    `
      UPDATE withdrawals
      SET status = 'out',
          withdrawn_by = $1,
          withdrawn_at = CURRENT_TIMESTAMP,
          notes = COALESCE(NULLIF(notes,''), '') || $2
      WHERE id = $3
    `,
    [withdrawn_by, notes ? (' | Converted from booking: ' + notes) : '', withdrawal_id],
  )

  return { success: true }
}