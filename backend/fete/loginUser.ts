type Params = { email: string; pin: string }

export default async function (req: { params: Params; user: User }) {
  const { email, pin } = req.params
  const result = await retoolDb.query<{
    id: number; name: string; email: string; role: string
  }>(`
    SELECT u.id, COALESCE(p.name, u.email) AS name, u.email, u.role
    FROM fete_users u
    LEFT JOIN people p ON p.id = u.person_id
    WHERE u.email = $1 AND u.pin = $2
  `, [email, pin])

  if (result.data.length === 0) {
    throw new Error('Invalid email or PIN')
  }
  return result.data[0]
}
