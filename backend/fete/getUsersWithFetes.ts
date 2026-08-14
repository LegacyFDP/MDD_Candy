export default async function (_req: { params: Record<string, never>; user: User }) {
  const result = await retoolDb.query(`
    SELECT u.id, u.name, u.email, u.role, u.pin
    FROM fete_users u
    ORDER BY u.role DESC, u.name ASC
  `)

  const users = (result.data as {
    id: number; name: string; email: string; role: string; pin: string
  }[]).map((row) => ({
    ...row,
    fetes: [],
  }))

  return users
}
