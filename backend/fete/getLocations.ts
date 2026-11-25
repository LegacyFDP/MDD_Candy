import { isSuperuser } from './personRecords.ts'

export default async function (req: { params: Record<string, never>; user: User }) {
  // Archived stores are only shown to the Superuser. Everyone else still sees
  // an archived store's name on the records that use it (assets, withdrawals),
  // because those handlers join the name directly.
  const showArchived = !req.user || isSuperuser(req.user)
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
      (SELECT p.name FROM fete_users u JOIN people p ON p.id = u.person_id
       WHERE u.id = store_locations.archived_by) AS archived_by_name
    FROM store_locations
    WHERE location_type = 'Store'
      ${showArchived ? '' : 'AND archived_at IS NULL'}
    ORDER BY name ASC
  `)
  return result.data
}
