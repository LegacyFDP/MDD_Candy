export default async function (_req: { params: Record<string, never>; user: User }) {
  const result = await retoolDb.query(`
    SELECT id, name, email, role, created_at
    FROM fete_users
    ORDER BY role DESC, name ASC
  `)
  return result.data
}

