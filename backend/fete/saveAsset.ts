type Params = {
  id?: number
  name: string
  category: string
  quantity_total: number
  location_id: number | null
  notes: string
}

export default async function (req: { params: Params; user: User }) {
  const { id, name, category, quantity_total, location_id, notes } = req.params

  if (id) {
    // Update: recalculate available = total - currently out
    await retoolDb.query(`
      UPDATE assets
      SET name = $1,
          category = $2,
          quantity_total = $3,
          quantity_available = $3 - (
            SELECT COALESCE(SUM(quantity), 0)
            FROM withdrawals
            WHERE asset_id = $4 AND status = 'out'
          ),
          location_id = $5,
          notes = $6
      WHERE id = $4
    `, [name, category, quantity_total, id, location_id, notes])
    return { success: true }
  } else {
    await retoolDb.query(`
      INSERT INTO assets (name, category, quantity_total, quantity_available, location_id, notes)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [name, category, quantity_total, quantity_total, location_id, notes])
    return { success: true }
  }
}
