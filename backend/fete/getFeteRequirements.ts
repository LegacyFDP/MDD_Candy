type Params = { fete_id: number }

export default async function (req: { params: Params; user: User }) {
  const result = await retoolDb.query(`
    SELECT fr.id, fr.fete_id, fr.quantity_needed, fr.notes,
           a.id AS asset_id, a.name AS asset_name, a.category,
           a.quantity_available
    FROM fete_requirements fr
    JOIN assets a ON fr.asset_id = a.id
    WHERE fr.fete_id = $1
    ORDER BY a.category, a.name
  `, [req.params.fete_id])
  return result.data
}
