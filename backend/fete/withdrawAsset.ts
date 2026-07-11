type Params = {
  asset_id: number
  fete_id: number | null
  quantity: number
  withdrawn_by: number
  notes: string
}

export default async function (req: { params: Params; user: User }) {
  const { asset_id, fete_id, quantity, withdrawn_by, notes } = req.params

  // Check available stock
  const check = await retoolDb.query<{ quantity_available: number }>(
    `SELECT quantity_available FROM assets WHERE id = $1`, [asset_id]
  )
  const asset = check.data[0]
  if (!asset || asset.quantity_available < quantity) {
    throw new Error(`Not enough stock available (${asset?.quantity_available ?? 0} in store)`)
  }

  // Deduct from available
  await retoolDb.query(`
    UPDATE assets SET quantity_available = quantity_available - $1 WHERE id = $2
  `, [quantity, asset_id])

  // Log withdrawal
  await retoolDb.query(`
    INSERT INTO withdrawals (asset_id, fete_id, quantity, withdrawn_by, notes)
    VALUES ($1, $2, $3, $4, $5)
  `, [asset_id, fete_id ?? null, quantity, withdrawn_by, notes])

  return { success: true }
}
