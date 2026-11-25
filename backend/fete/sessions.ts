// Login sessions. No default export, so the server does not expose it as an API.
//
// Signing in issues a random token. The browser sends it with every request
// and the server looks it up here to find out who is calling and what role
// they hold. Only a SHA-256 hash of the token is stored, so a copy of the
// database cannot be used to sign in as anyone.

import { createHash, randomBytes } from 'node:crypto'
import { accountRoleSql } from './personRecords.ts'

/** How long a sign-in lasts before the user must sign in again. */
export const SESSION_HOURS = 12

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

/** Starts a session for a login account and returns its token. */
export async function createSession(userId: number): Promise<string> {
  const token = randomBytes(32).toString('hex')
  await retoolDb.query("DELETE FROM user_sessions WHERE expires_at <= datetime('now')")
  await retoolDb.query(
    `INSERT INTO user_sessions (token_hash, user_id, expires_at)
     VALUES ($1, $2, datetime('now', $3))`,
    [hashToken(token), userId, `+${SESSION_HOURS} hours`],
  )
  return token
}

/**
 * The signed-in user for a token, or null if the token is unknown or expired.
 * The role is read fresh on every request, so a role change takes effect at
 * once without signing out.
 */
export async function getSessionUser(token: string): Promise<NonNullable<User> | null> {
  if (!token) return null
  const result = await retoolDb.query<NonNullable<User>>(
    `SELECT u.id, COALESCE(p.name, u.email) AS name, u.email, ${accountRoleSql('u.person_id')} AS role
     FROM user_sessions s
     JOIN fete_users u ON u.id = s.user_id
     LEFT JOIN people p ON p.id = u.person_id
     WHERE s.token_hash = $1 AND s.expires_at > datetime('now')`,
    [hashToken(token)],
  )
  return result.data[0] ?? null
}

/** Ends a session (sign out). */
export async function deleteSession(token: string): Promise<void> {
  if (!token) return
  await retoolDb.query('DELETE FROM user_sessions WHERE token_hash = $1', [hashToken(token)])
}
