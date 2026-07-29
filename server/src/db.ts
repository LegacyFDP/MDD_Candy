import sqlite3 from 'sqlite3'
import path from 'node:path'
function requireEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(`${name} is required. Configure it in your environment before starting the server.`)
  }
  return value
}

// DB_PATH is required so backup and restore behavior is explicit in every
// environment and never silently points to an unexpected local file.
const dbPath = path.resolve(requireEnv('DB_PATH'))

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
  await run(
    `
      CREATE TABLE IF NOT EXISTS volunteers (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        name          TEXT NOT NULL,
        email         TEXT NOT NULL UNIQUE,
        address_line1 TEXT NOT NULL DEFAULT '',
        address_line2 TEXT NOT NULL DEFAULT '',
        town_city     TEXT NOT NULL DEFAULT '',
        county        TEXT NOT NULL DEFAULT '',
        postcode      TEXT NOT NULL DEFAULT '',
        phone_home    TEXT NOT NULL DEFAULT '',
        phone_mobile  TEXT NOT NULL DEFAULT '',
        skills        TEXT NOT NULL DEFAULT '',
        notes         TEXT NOT NULL DEFAULT '',
        created_at    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `,
    [],
    database,
  )

  const volunteerColumns = await all<{ name: string }>('PRAGMA table_info(volunteers);', [], database)
  const volunteerExisting = new Set(volunteerColumns.map((column) => column.name))
  const volunteerAdditions = [
    { name: 'address_line1', sqlType: "TEXT NOT NULL DEFAULT ''" },
    { name: 'address_line2', sqlType: "TEXT NOT NULL DEFAULT ''" },
    { name: 'town_city', sqlType: "TEXT NOT NULL DEFAULT ''" },
    { name: 'county', sqlType: "TEXT NOT NULL DEFAULT ''" },
    { name: 'postcode', sqlType: "TEXT NOT NULL DEFAULT ''" },
    { name: 'phone_home', sqlType: "TEXT NOT NULL DEFAULT ''" },
    { name: 'phone_mobile', sqlType: "TEXT NOT NULL DEFAULT ''" },
    { name: 'skills', sqlType: "TEXT NOT NULL DEFAULT ''" },
    { name: 'notes', sqlType: "TEXT NOT NULL DEFAULT ''" },
  ]

  for (const addition of volunteerAdditions) {
    if (volunteerExisting.has(addition.name)) continue
    await run(
      `ALTER TABLE volunteers ADD COLUMN ${addition.name} ${addition.sqlType};`,
      [],
      database,
    )
    console.log(`Added missing volunteers column: ${addition.name}`)
  }

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

  await run(
    `
      CREATE TABLE IF NOT EXISTS volunteer_roles (
        role_key      TEXT PRIMARY KEY,
        display_name  TEXT NOT NULL UNIQUE
      )
    `,
    [],
    database,
  )

  await run(
    `
      CREATE TABLE IF NOT EXISTS fete_volunteer_assignments (
        id                       INTEGER PRIMARY KEY AUTOINCREMENT,
        fete_id                  INTEGER NOT NULL REFERENCES fetes(id) ON DELETE CASCADE,
        volunteer_id             INTEGER NOT NULL REFERENCES volunteers(id) ON DELETE CASCADE,
        role_key                 TEXT NOT NULL REFERENCES volunteer_roles(role_key),
        role_other               TEXT NOT NULL DEFAULT '',
        notes                    TEXT NOT NULL DEFAULT '',
        added_by_user_id         INTEGER REFERENCES fete_users(id) ON DELETE SET NULL,
        legacy_fete_volunteer_id INTEGER,
        created_at               TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at               TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (fete_id, volunteer_id)
      )
    `,
    [],
    database,
  )

  await run(
    `
      CREATE TABLE IF NOT EXISTS fete_volunteer_availability (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        assignment_id INTEGER NOT NULL REFERENCES fete_volunteer_assignments(id) ON DELETE CASCADE,
        slot_date     TEXT NOT NULL,
        start_hour    INTEGER NOT NULL CHECK (start_hour >= 9 AND start_hour <= 17),
        end_hour      INTEGER NOT NULL CHECK (end_hour = start_hour + 1 AND end_hour >= 10 AND end_hour <= 18),
        UNIQUE (assignment_id, slot_date, start_hour)
      )
    `,
    [],
    database,
  )

  await run(
    `
      CREATE TABLE IF NOT EXISTS db_backups (
        id                 INTEGER PRIMARY KEY AUTOINCREMENT,
        filename           TEXT NOT NULL UNIQUE,
        absolute_path      TEXT NOT NULL,
        byte_size          INTEGER NOT NULL DEFAULT 0,
        reason             TEXT NOT NULL DEFAULT 'manual',
        created_by_user_id INTEGER REFERENCES fete_users(id) ON DELETE SET NULL,
        deleted_by_user_id INTEGER REFERENCES fete_users(id) ON DELETE SET NULL,
        created_at         TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        deleted_at         TEXT
      )
    `,
    [],
    database,
  )

  const roles = [
    ['Lead Volunteer', 'Lead Volunteer'],
    ['Helper', 'Helper'],
    ['Putting Up', 'Putting Up'],
    ['Taking Down', 'Taking Down'],
    ['Transport', 'Transport'],
    ['Stall Holder', 'Stall Holder'],
    ['Other', 'Other'],
  ]

  for (const [roleKey, displayName] of roles) {
    await run(
      'INSERT OR IGNORE INTO volunteer_roles (role_key, display_name) VALUES (?, ?)',
      [roleKey, displayName],
      database,
    )
  }

  // Ensure legacy fete_users that were used as volunteers are represented in
  // the normalized volunteers table before migrating assignments.
  await run(
    `
      INSERT INTO volunteers (name, email, notes)
      SELECT u.name, LOWER(TRIM(u.email)), ''
      FROM fete_users u
      JOIN fete_volunteers fv ON fv.user_id = u.id
      LEFT JOIN volunteers v ON LOWER(TRIM(v.email)) = LOWER(TRIM(u.email))
      WHERE v.id IS NULL
    `,
    [],
    database,
  )

  // Backfill normalized assignments from legacy fete_volunteers records.
  await run(
    `
      INSERT OR IGNORE INTO fete_volunteer_assignments (
        fete_id,
        volunteer_id,
        role_key,
        role_other,
        notes,
        added_by_user_id,
        legacy_fete_volunteer_id,
        created_at,
        updated_at
      )
      SELECT
        fv.fete_id,
        v.id,
        CASE
          WHEN TRIM(COALESCE(fv.role, '')) IN (
            'Lead Volunteer',
            'Helper',
            'Putting Up',
            'Taking Down',
            'Transport',
            'Stall Holder'
          ) THEN TRIM(fv.role)
          ELSE 'Other'
        END AS role_key,
        CASE
          WHEN TRIM(COALESCE(fv.role, '')) IN (
            'Lead Volunteer',
            'Helper',
            'Putting Up',
            'Taking Down',
            'Transport',
            'Stall Holder'
          ) THEN ''
          ELSE TRIM(COALESCE(fv.role, ''))
        END AS role_other,
        TRIM(COALESCE(fv.notes, '')),
        fv.user_id,
        fv.id,
        COALESCE(fv.added_at, CURRENT_TIMESTAMP),
        CURRENT_TIMESTAMP
      FROM fete_volunteers fv
      JOIN fete_users u ON u.id = fv.user_id
      JOIN volunteers v ON LOWER(TRIM(v.email)) = LOWER(TRIM(u.email))
    `,
    [],
    database,
  )
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
