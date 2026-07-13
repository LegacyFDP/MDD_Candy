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

async function runWithMeta(
  sql: string,
  params: unknown[] = [],
  database: sqlite3.Database = db,
): Promise<{ lastID: number; changes: number }> {
  return new Promise((resolve, reject) => {
    database.run(sql, params, function onRun(this: sqlite3.RunResult, err) {
      if (err) reject(err)
      else resolve({ lastID: this.lastID, changes: this.changes })
    })
  })
}

export async function ensureRuntimeSchema(database: sqlite3.Database = db): Promise<void> {
  const locationColumns = await all<{ name: string }>('PRAGMA table_info(store_locations);', [], database)
  const locationExisting = new Set(locationColumns.map((column) => column.name))

  const locationAdditions = [
    { name: 'address_line1', sqlType: "TEXT NOT NULL DEFAULT ''" },
    { name: 'address_line2', sqlType: "TEXT NOT NULL DEFAULT ''" },
    { name: 'town_city', sqlType: "TEXT NOT NULL DEFAULT ''" },
    { name: 'county', sqlType: "TEXT NOT NULL DEFAULT ''" },
    { name: 'postcode', sqlType: "TEXT NOT NULL DEFAULT ''" },
    { name: 'location_type', sqlType: "TEXT NOT NULL DEFAULT 'Store'" },
    { name: 'notes', sqlType: "TEXT NOT NULL DEFAULT ''" },
  ]

  for (const addition of locationAdditions) {
    if (locationExisting.has(addition.name)) continue
    await run(
      `ALTER TABLE store_locations ADD COLUMN ${addition.name} ${addition.sqlType};`,
      [],
      database,
    )
    console.log(`Added missing store_locations column: ${addition.name}`)
  }

  const feteColumns = await all<{ name: string }>('PRAGMA table_info(fetes);', [], database)
  const feteExisting = new Set(feteColumns.map((column) => column.name))
  if (!feteExisting.has('notes')) {
    await run("ALTER TABLE fetes ADD COLUMN notes TEXT NOT NULL DEFAULT '';", [], database)
    console.log('Added missing fetes column: notes')
  }

  await run(
    "UPDATE store_locations SET location_type = 'Store' WHERE location_type IS NULL OR TRIM(location_type) = ''",
    [],
    database,
  )

  const legacyFeteTable = await all<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='fete_locations'",
    [],
    database,
  )

  if (legacyFeteTable.length > 0) {
    const legacyRows = await all<{ id: number; name: string; description: string }>(
      'SELECT id, name, description FROM fete_locations ORDER BY id ASC',
      [],
      database,
    )

    if (legacyRows.length > 0) {
      for (const row of legacyRows) {
        const inserted = await runWithMeta(
          `
            INSERT INTO store_locations (
              name,
              description,
              address_line1,
              address_line2,
              town_city,
              county,
              postcode,
              location_type
            )
            VALUES (?, ?, '', '', '', '', '', 'Fetes')
          `,
          [row.name, row.description ?? ''],
          database,
        )

        await run(
          'UPDATE fetes SET location_id = ? WHERE location_id = ?',
          [inserted.lastID, row.id],
          database,
        )
      }

      await run('DELETE FROM fete_locations', [], database)
      console.log(`Migrated ${legacyRows.length} legacy fete_locations rows into store_locations`)
    }
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
