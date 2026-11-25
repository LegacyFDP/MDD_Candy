import { accountRoleSql } from './personRecords.ts'
import { createSession } from './sessions.ts'

type Params = { email: string; pin: string }

export default async function (req: { params: Params; user: User }) {
  const { email, pin } = req.params
  const result = await retoolDb.query<{
    id: number; name: string; email: string; role: string
  }>(`
    SELECT u.id, COALESCE(p.name, u.email) AS name, u.email, ${accountRoleSql('u.person_id')} AS role
    FROM fete_users u
    LEFT JOIN people p ON p.id = u.person_id
    WHERE u.email = $1 AND u.pin = $2
  `, [email, pin])

  const user = result.data[0]
  if (!user) {
    throw new Error('Invalid email or PIN')
  }
  // The browser sends this token with every later request; see sessions.ts.
  const token = await createSession(user.id)
  return { ...user, token }
}
