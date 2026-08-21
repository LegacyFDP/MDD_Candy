type Params = { location_id?: number }

export default async function (req: { params: Params; user: User }) {
  const locationFilter = req.params.location_id != null ? 'AND sa.location_id = $1' : ''
  const params = req.params.location_id != null ? [req.params.location_id] : []
  const result = await retoolDb.query(`
    SELECT sa.id, sa.location_id, sa.name, sa.description, sa.notes, sa.created_at,
           sl.name AS location_name
    FROM storage_areas sa
    INNER JOIN store_locations sl ON sl.id = sa.location_id
    WHERE sl.location_type = 'Store' ${locationFilter}
    ORDER BY sl.name ASC, sa.name ASC
  `, params)
  return result.data
}