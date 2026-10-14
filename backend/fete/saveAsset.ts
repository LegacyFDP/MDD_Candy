type Params = {
  id?: number
  name: string
  category: string
  quantity_total: number
  location_id: number | null
  storage_area_id: number | null
  notes: string
}

export default async function (req: { params: Params; user: User }) {
  const { id, category, quantity_total, location_id, storage_area_id, notes } = req.params
  const name = (req.params.name ?? '').trim()

  if (!name) throw new Error('Asset name is required')
  if (!Number.isInteger(quantity_total) || quantity_total < 0) {
    throw new Error('Total quantity must be 0 or greater')
  }

  if (storage_area_id != null) {
    if (location_id == null) throw new Error('A Storage Area requires a Store Location')
    const area = await retoolDb.query<{ id: number }>(
      `SELECT sa.id
       FROM storage_areas sa
       INNER JOIN store_locations sl ON sl.id = sa.location_id
       WHERE sa.id = $1 AND sa.location_id = $2 AND sl.location_type = 'Store' AND sl.archived_at IS NULL`,
      [storage_area_id, location_id],
    )
    if (area.data.length === 0) throw new Error('Storage Area must belong to the selected active Store Location')
  }

  const duplicate = await retoolDb.query<{ id: number }>(
    `SELECT id FROM assets WHERE name = $1 COLLATE NOCASE ${id ? 'AND id <> $2' : ''}`,
    id ? [name, id] : [name],
  )
  if (duplicate.data.length > 0) {
    throw new Error('An asset with this name already exists')
  }

  if (id) {
    const reservedCheck = await retoolDb.query<{ qty_out: number; qty_booked: number }>(
      `SELECT
         COALESCE(SUM(CASE WHEN status = 'out' THEN quantity ELSE 0 END), 0) AS qty_out,
         COALESCE(SUM(CASE WHEN status = 'booked' THEN quantity ELSE 0 END), 0) AS qty_booked
       FROM withdrawals
       WHERE asset_id = $1 AND status IN ('out', 'booked')`,
      [id],
    )
    const qtyOut = Number(reservedCheck.data[0]?.qty_out ?? 0)
    const qtyBooked = Number(reservedCheck.data[0]?.qty_booked ?? 0)
    if (quantity_total < qtyOut + qtyBooked) {
      throw new Error(
        `Cannot reduce total quantity below active withdrawals and bookings (${qtyOut} out, ${qtyBooked} booked)`
      )
    }

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
          storage_area_id = $6,
          notes = $7
      WHERE id = $4
    `, [name, category, quantity_total, id, location_id, storage_area_id ?? null, notes])
    return { success: true }
  } else {
    await retoolDb.query(`
      INSERT INTO assets (name, category, quantity_total, quantity_available, location_id, storage_area_id, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [name, category, quantity_total, quantity_total, location_id, storage_area_id ?? null, notes])
    return { success: true }
  }
}
