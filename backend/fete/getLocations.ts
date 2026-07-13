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
      postcode
    FROM store_locations
    WHERE location_type = 'Store'
    ORDER BY name ASC
  `)
  return result.data
}
