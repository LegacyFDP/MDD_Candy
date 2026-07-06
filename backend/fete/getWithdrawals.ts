type Params = { status?: string }

export default async function (req: { params: Params; user: User }) {
  const { status } = req.params

  if (status === 'out' || status === 'returned') {
    const result = await retoolDb.query(`
      SELECT w.id, w.fete_id, w.quantity, w.withdrawn_at, w.returned_at, w.status, w.notes,
             a.id AS asset_id, a.name AS asset_name, a.category,
             sl.name AS store_name,
             u1.name AS withdrawn_by_name,
             u2.name AS returned_by_name,
             f.name AS fete_name
      FROM withdrawals w
      JOIN assets a ON w.asset_id = a.id
      LEFT JOIN store_locations sl ON a.location_id = sl.id
      JOIN fete_users u1 ON w.withdrawn_by = u1.id
      LEFT JOIN fete_users u2 ON w.returned_by = u2.id
      LEFT JOIN fetes f ON w.fete_id = f.id
      WHERE w.status = $1
      ORDER BY w.withdrawn_at DESC
    `, [status])
    return result.data
  }

  const result = await retoolDb.query(`
    SELECT w.id, w.fete_id, w.quantity, w.withdrawn_at, w.returned_at, w.status, w.notes,
           a.id AS asset_id, a.name AS asset_name, a.category,
           sl.name AS store_name,
           u1.name AS withdrawn_by_name,
           u2.name AS returned_by_name,
           f.name AS fete_name
    FROM withdrawals w
    JOIN assets a ON w.asset_id = a.id
    LEFT JOIN store_locations sl ON a.location_id = sl.id
    JOIN fete_users u1 ON w.withdrawn_by = u1.id
    LEFT JOIN fete_users u2 ON w.returned_by = u2.id
    LEFT JOIN fetes f ON w.fete_id = f.id
    ORDER BY w.withdrawn_at DESC
  `)
  return result.data
}
