export default async function (_req: { params: Record<string, never>; user: User }) {
  const result = await retoolDb.query(`
    SELECT
      id,
      name,
      description,
      notes,
      address_line1,
      address_line2,
      town_city,
      county,
      postcode,
      archived_at,
      archived_by,
      (SELECT name FROM fete_users WHERE id = store_locations.archived_by) AS archived_by_name
    FROM store_locations
    WHERE location_type = 'Store'
    ORDER BY name ASC
  `)
  return result.data
}
