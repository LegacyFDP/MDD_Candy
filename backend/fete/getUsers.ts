export default async function (_req: { params: Record<string, never>; user: User }) {
  const result = await retoolDb.query(`
    SELECT u.id, COALESCE(p.name, u.email) AS name, u.email, u.role, u.pin, u.created_at
    FROM fete_users u
    LEFT JOIN people p ON p.id = u.person_id
    ORDER BY u.role DESC, name ASC
  `)
  return result.data
}
