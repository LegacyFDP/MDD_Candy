type Params = { fete_id: number }

export default async function (req: { params: Params; user: User }) {
  const result = await retoolDb.query(`
    SELECT w.id, w.quantity, w.withdrawn_at, w.returned_at, w.status, w.notes,
           a.id AS asset_id, a.name AS asset_name, COALESCE(c.name, 'Other') AS category,
           p1.name AS withdrawn_by_name
    FROM withdrawals w
    JOIN assets a ON w.asset_id = a.id
    LEFT JOIN asset_categories c ON a.category_id = c.id
    JOIN fete_users u1 ON w.withdrawn_by = u1.id
    LEFT JOIN people p1 ON u1.person_id = p1.id
    WHERE w.fete_id = $1
    ORDER BY category, a.name
  `, [req.params.fete_id])
  return result.data
}
