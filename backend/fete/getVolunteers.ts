import { requireAdmin } from './_auth'

export default async function (_req: { params: Record<string, never>; user: User }) {
  requireAdmin(_req.user)

  const result = await retoolDb.query(`
    SELECT
      id,
      name,
      email,
      address_line1,
      address_line2,
      town_city,
      county,
      postcode,
      phone_home,
      phone_mobile,
      skills,
      notes,
      created_at
    FROM volunteers
    ORDER BY name ASC
  `)
  return result.data
}
