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

async function all<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
  database: sqlite3.Database = db,
): Promise<T[]> {
  return new Promise((resolve, reject) => {
    database.all(sql, params, (err, rows) => {
      if (err) reject(err)
      else resolve((rows as T[]) ?? [])
    })
  })
}

async function run(
  sql: string,
  params: unknown[] = [],
  database: sqlite3.Database = db,
): Promise<void> {
  return new Promise((resolve, reject) => {
    database.run(sql, params, (err) => {
      if (err) reject(err)
      else resolve()
    })
  })
}

export async function ensureRuntimeSchema(database: sqlite3.Database = db): Promise<void> {
  const columns = await all<{ name: string }>('PRAGMA table_info(store_locations);', [], database)
  const existing = new Set(columns.map((column) => column.name))

  const additions = [
    { name: 'address_line1', sqlType: "TEXT NOT NULL DEFAULT ''" },
    { name: 'address_line2', sqlType: "TEXT NOT NULL DEFAULT ''" },
    { name: 'town_city', sqlType: "TEXT NOT NULL DEFAULT ''" },
    { name: 'county', sqlType: "TEXT NOT NULL DEFAULT ''" },
    { name: 'postcode', sqlType: "TEXT NOT NULL DEFAULT ''" },
  ]

  for (const addition of additions) {
    if (existing.has(addition.name)) continue
    await run(
      `ALTER TABLE store_locations ADD COLUMN ${addition.name} ${addition.sqlType};`,
      [],
      database,
    )
    console.log(`Added missing store_locations column: ${addition.name}`)
  }
}

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
