type Params = { email: string; pin: string }

export default async function (req: { params: Params; user: User }) {
  const { email, pin } = req.params
  const result = await retoolDb.query<{
    id: number; name: string; email: string; role: string
  }>(`SELECT id, name, email, role FROM fete_users WHERE email = $1 AND pin = $2`, [email, pin])

  if (result.data.length === 0) {
    throw new Error('Invalid email or PIN')
  }
  return result.data[0]
}
