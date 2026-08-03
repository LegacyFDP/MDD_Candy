type Params = {
  asset_id: number
  fete_id: number
  quantity: number
  booked_by: number
  notes: string
}

export default async function (req: { params: Params; user: User }) {
  const { asset_id, fete_id, quantity, booked_by, notes } = req.params

  if (!fete_id) {
    throw new Error('Fete is required when booking an asset')
  }

  if (quantity <= 0) {
    throw new Error('Booking quantity must be greater than 0')
  }

  const userCheck = await retoolDb.query<{ id: number; role: string }>(
    `SELECT id, role FROM fete_users WHERE id = $1`,
    [booked_by],
  )
  const actingUser = userCheck.data[0]
  if (!actingUser) {
    throw new Error('Booked by user not found')
  }
  if (actingUser.role !== 'admin' && actingUser.role !== 'store keeper') {
    throw new Error('Only admin or store keeper can change asset status')
  }

  const feteCheck = await retoolDb.query<{ id: number; status: string }>(
    `SELECT id, status FROM fetes WHERE id = $1`,
    [fete_id],
  )
  const fete = feteCheck.data[0]
  if (!fete) {
    throw new Error('Fete not found')
  }
  if (fete.status === 'completed') {
    throw new Error('Cannot create bookings for a completed fete')
  }

  // Validate the asset exists and quantity does not exceed owned stock.
  const check = await retoolDb.query<{ quantity_total: number }>(
    `SELECT quantity_total FROM assets WHERE id = $1`, [asset_id]
  )
  const asset = check.data[0]
  if (!asset) {
    throw new Error('Asset not found')
  }
  if (quantity > asset.quantity_total) {
    throw new Error(`Cannot book more than total stock (${asset.quantity_total})`)
  }

  const reservedCheck = await retoolDb.query<{ quantity_reserved: number }>(
    `
      SELECT COALESCE(SUM(quantity), 0) AS quantity_reserved
      FROM withdrawals
      WHERE asset_id = $1
        AND status IN ('booked', 'out')
    `,
    [asset_id],
  )
  const quantityReserved = Number(reservedCheck.data[0]?.quantity_reserved ?? 0)
  const quantityRemainingToReserve = asset.quantity_total - quantityReserved
  if (quantity > quantityRemainingToReserve) {
    throw new Error(
      `Not enough stock to book (${quantityRemainingToReserve} left after existing bookings/withdrawals)`
    )
  }

  await retoolDb.query(`
    INSERT INTO withdrawals (asset_id, fete_id, quantity, withdrawn_by, status, notes)
    VALUES ($1, $2, $3, $4, 'booked', $5)
  `, [asset_id, fete_id, quantity, booked_by, notes])

  return { success: true }
}