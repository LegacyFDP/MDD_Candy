// Grants (or revokes) the Superuser role for an existing login account.
//
//   npm run superuser:grant --prefix server -- someone@example.com
//   npm run superuser:grant --prefix server -- someone@example.com --revoke
//
// The Superuser can see and restore archived stores and events and
// permanently delete stores. The role cannot be granted from the People page.

import 'dotenv/config'
import { db, ensureRuntimeSchema, createRetoolDb } from './db.js'

const SUPERUSER_ROLE = 'Superuser'

async function main() {
  const args = process.argv.slice(2)
  const revoke = args.includes('--revoke')
  const email = args.find(arg => !arg.startsWith('--'))?.trim()
  if (!email) throw new Error('Usage: npm run superuser:grant -- <login email> [--revoke]')

  await ensureRuntimeSchema()
  const retoolDb = createRetoolDb()

  const found = await retoolDb.query(
    `SELECT u.person_id, COALESCE(p.name, u.email) AS name
     FROM fete_users u LEFT JOIN people p ON p.id = u.person_id
     WHERE LOWER(u.email) = LOWER($1)`,
    [email],
  ) as { data: { person_id: number | null; name: string }[] }
  const account = found.data[0]
  if (!account) throw new Error(`No login account uses ${email}`)
  if (!account.person_id) throw new Error(`The login ${email} is not linked to a person record`)

  if (revoke) {
    await retoolDb.query('DELETE FROM person_roles WHERE person_id = $1 AND role = $2', [account.person_id, SUPERUSER_ROLE])
    console.log(`Removed Superuser from ${account.name} (${email})`)
  } else {
    await retoolDb.query('INSERT OR IGNORE INTO person_roles (person_id, role) VALUES ($1, $2)', [account.person_id, SUPERUSER_ROLE])
    console.log(`${account.name} (${email}) is now the Superuser. Sign out and in again to see it.`)
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
  .finally(() => db.close())
