type Params = {
  asset_id: number
  fete_id: number | null
  quantity: number
  withdrawn_by: number
  notes: string
}

export default async function (req: { params: Params; user: User }) {
  const { asset_id, fete_id, quantity, withdrawn_by, notes } = req.params

  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new Error('Withdrawal quantity must be greater than 0')
  }

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

  if (fete_id != null) {
    const feteCheck = await retoolDb.query<{ id: number; status: string }>(
      `SELECT id, status FROM fetes WHERE id = $1`,
      [fete_id],
    )
    const fete = feteCheck.data[0]
    if (!fete) throw new Error('Fete not found')
    if (fete.status === 'completed') {
      throw new Error('Cannot withdraw assets for a completed fete')
    }
  }

  // Check available and unreserved stock
  const check = await retoolDb.query<{ quantity_total: number; quantity_available: number }>(
    `SELECT quantity_total, quantity_available FROM assets WHERE id = $1`, [asset_id]
  )
  const asset = check.data[0]
  if (!asset || asset.quantity_available < quantity) {
    throw new Error(`Not enough stock available (${asset?.quantity_available ?? 0} in store)`)
  }

  const bookedCheck = await retoolDb.query<{ quantity_booked: number }>(
    `SELECT COALESCE(SUM(quantity), 0) AS quantity_booked
     FROM withdrawals
     WHERE asset_id = $1 AND status = 'booked'`,
    [asset_id],
  )
  const quantityBooked = Number(bookedCheck.data[0]?.quantity_booked ?? 0)
  const unreservedAvailable = asset.quantity_available - quantityBooked
  if (quantity > unreservedAvailable) {
    throw new Error(
      `Not enough unbooked stock available (${Math.max(0, unreservedAvailable)} unbooked of ${asset.quantity_available} in store)`
    )
  }

  const applyWithdraw = async () => {
    // Deduct from available
    await retoolDb.query(`
      UPDATE assets SET quantity_available = quantity_available - $1 WHERE id = $2
    `, [quantity, asset_id])

    // Log withdrawal
    await retoolDb.query(`
      INSERT INTO withdrawals (asset_id, fete_id, quantity, withdrawn_by, notes)
      VALUES ($1, $2, $3, $4, $5)
    `, [asset_id, fete_id ?? null, quantity, withdrawn_by, notes])
  }

  if (retoolDb.transaction) {
    await retoolDb.transaction(applyWithdraw)
  } else {
    await applyWithdraw()
  }

  return { success: true }
}
