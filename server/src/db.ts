import sqlite3 from 'sqlite3'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
// DB_PATH lets containerized deployments point the SQLite file at a mounted
// volume; local/dev runs fall back to the repo-root file.
const dbPath = process.env.DB_PATH
  ? path.resolve(process.env.DB_PATH)
  : path.resolve(here, '..', '..', 'MDD_Candy.db')

// SQLite database connection
export const db = new sqlite3.Database(dbPath, (err) => {
  if (err) console.error('Database connection error:', err)
  else console.log(`Connected to SQLite database at ${dbPath}`)
})

/**
 * Re-creates the `retoolDb` interface the original backend functions expect:
 *   const result = await retoolDb.query<T>(text, params)
 *   result.data // -> rows
 */
export function createRetoolDb(database: sqlite3.Database = db) {
  return {
    async query<T = Record<string, unknown>>(text: string, params: unknown[] = []) {
      // Retool-exported handlers use Postgres placeholders ($1, $2, ...).
      // SQLite expects positional placeholders (?); remap to keep handlers unchanged.
      const sqliteParams: unknown[] = []
      const sqliteText = text.replace(/\$(\d+)/g, (_match, indexText: string) => {
        const index = Number(indexText) - 1
        sqliteParams.push(params[index])
        return '?'
      })

      return new Promise((resolve, reject) => {
        database.all(sqliteText, sqliteParams, (err, rows) => {
          if (err) reject(err)
          else resolve({ data: (rows as T[]) ?? [] })
        })
      })
    },
  }
}
