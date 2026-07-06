type Params = { fete_id: number }

export default async function (req: { params: Params; user: User }) {
  const result = await retoolDb.query(`
    SELECT w.id, w.quantity, w.withdrawn_at, w.returned_at, w.status, w.notes,
           a.id AS asset_id, a.name AS asset_name, a.category,
           u1.name AS withdrawn_by_name
    FROM withdrawals w
    JOIN assets a ON w.asset_id = a.id
    JOIN fete_users u1 ON w.withdrawn_by = u1.id
    WHERE w.fete_id = $1
    ORDER BY a.category, a.name
  `, [req.params.fete_id])
  return result.data
}
