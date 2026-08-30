import sqlite3 from 'sqlite3'
import path from 'node:path'
import { resolveRuntimePaths } from './config.ts'

const { dbPath } = resolveRuntimePaths()

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
      CREATE TABLE IF NOT EXISTS fete_users (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        name       TEXT NOT NULL,
        email      TEXT NOT NULL UNIQUE,
        role       TEXT NOT NULL DEFAULT 'user',
        pin        TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `,
    [],
    database,
  )

  await run(
    `
      CREATE TABLE IF NOT EXISTS store_locations (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        name          TEXT NOT NULL,
        description   TEXT NOT NULL DEFAULT '',
        notes         TEXT NOT NULL DEFAULT '',
        address_line1 TEXT NOT NULL DEFAULT '',
        address_line2 TEXT NOT NULL DEFAULT '',
        town_city     TEXT NOT NULL DEFAULT '',
        county        TEXT NOT NULL DEFAULT '',
        postcode      TEXT NOT NULL DEFAULT '',
        location_type TEXT NOT NULL DEFAULT 'Store'
      )
    `,
    [],
    database,
  )

  await run(
    `
      CREATE TABLE IF NOT EXISTS assets (
        id                 INTEGER PRIMARY KEY AUTOINCREMENT,
        name               TEXT NOT NULL,
        category           TEXT NOT NULL DEFAULT 'Other',
        quantity_total     INTEGER NOT NULL DEFAULT 0,
        quantity_available INTEGER NOT NULL DEFAULT 0,
        location_id        INTEGER REFERENCES store_locations(id) ON DELETE SET NULL,
        notes              TEXT NOT NULL DEFAULT '',
        created_at         TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `,
    [],
    database,
  )

  await run(
    `
      CREATE TABLE IF NOT EXISTS fetes (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        name        TEXT NOT NULL,
        event_date  DATE,
        description TEXT NOT NULL DEFAULT '',
        notes       TEXT NOT NULL DEFAULT '',
        status      TEXT NOT NULL DEFAULT 'planned',
        created_by  INTEGER REFERENCES fete_users(id) ON DELETE SET NULL,
        location_id INTEGER REFERENCES store_locations(id) ON DELETE SET NULL,
        created_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `,
    [],
    database,
  )

  await run(
    `
      CREATE TABLE IF NOT EXISTS withdrawals (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        asset_id     INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
        fete_id      INTEGER REFERENCES fetes(id) ON DELETE SET NULL,
        quantity     INTEGER NOT NULL,
        withdrawn_by INTEGER NOT NULL REFERENCES fete_users(id),
        returned_by  INTEGER REFERENCES fete_users(id),
        withdrawn_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        returned_at  TEXT,
        status       TEXT NOT NULL DEFAULT 'out',
        notes        TEXT NOT NULL DEFAULT ''
      )
    `,
    [],
    database,
  )

  await run(
    `
      CREATE TABLE IF NOT EXISTS fete_requirements (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        fete_id         INTEGER NOT NULL REFERENCES fetes(id) ON DELETE CASCADE,
        asset_id        INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
        quantity_needed INTEGER NOT NULL,
        notes           TEXT NOT NULL DEFAULT ''
      )
    `,
    [],
    database,
  )

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
      CREATE TABLE IF NOT EXISTS fete_volunteers (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        name       TEXT NOT NULL,
        email      TEXT,
        phone      TEXT,
        role       TEXT NOT NULL DEFAULT 'Helper',
        notes      TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `,
    [],
    database,
  )

  await run(
    `
      CREATE TABLE IF NOT EXISTS volunteer_shifts (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        volunteer_id INTEGER NOT NULL REFERENCES fete_volunteers(id) ON DELETE CASCADE,
        fete_id     INTEGER REFERENCES fetes(id) ON DELETE CASCADE,
        role        TEXT NOT NULL DEFAULT 'Helper',
        start_date  TEXT NOT NULL,
        end_date    TEXT NOT NULL,
        start_time  TEXT NOT NULL,
        end_time    TEXT NOT NULL,
        created_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `,
    [],
    database,
  )

  const shiftColumns = await all<{ name: string }>('PRAGMA table_info(volunteer_shifts);', [], database)
  const shiftExisting = new Set(shiftColumns.map((column) => column.name))
  if (!shiftExisting.has('start_date')) {
    await run('ALTER TABLE volunteer_shifts ADD COLUMN start_date TEXT NOT NULL DEFAULT CURRENT_DATE;', [], database)
  }
  if (!shiftExisting.has('end_date')) {
    await run('ALTER TABLE volunteer_shifts ADD COLUMN end_date TEXT NOT NULL DEFAULT CURRENT_DATE;', [], database)
  }

  // Only present on legacy DBs that predate the start_date/end_date columns
  if (shiftExisting.has('shift_date')) {
    await run(
      `
        UPDATE volunteer_shifts
        SET start_date = COALESCE(start_date, shift_date, CURRENT_DATE),
            end_date = COALESCE(end_date, shift_date, CURRENT_DATE)
        WHERE start_date IS NULL OR end_date IS NULL
      `,
      [],
      database,
    )
  }

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

  const userCount = await all<{ count: number }>('SELECT COUNT(*) AS count FROM fete_users', [], database)
  if ((userCount[0]?.count ?? 0) === 0) {
    await run(
      `
        INSERT INTO fete_users (name, email, role, pin) VALUES
          ('Alice Adams', 'alice@charity.org', 'admin', '1234'),
          ('Bob Brown', 'bob@charity.org', 'admin', '2345'),
          ('Carol Clarke', 'carol@charity.org', 'user', '3456'),
          ('Dan Davies', 'dan@charity.org', 'user', '4567')
      `,
      [],
      database,
    )

    await run(
      `
        INSERT INTO store_locations (
          name,
          description,
          notes,
          address_line1,
          address_line2,
          town_city,
          county,
          postcode,
          location_type
        ) VALUES
          ('Main Cupboard', 'Hallway cupboard by the office', '', 'St Mary''s Church Hall', '12 Hall Lane', 'Oxford', 'Oxfordshire', 'OX1 1AA', 'Store'),
          ('Garage', 'Lock-up garage behind the hall', '', 'Parish Storage Garage', 'Rear of 28 Market Street', 'Oxford', 'Oxfordshire', 'OX2 7BG', 'Store'),
          ('Loft', 'Above the main hall - ladder access', '', 'Village Community Centre', '4 Chapel Road', 'Abingdon', 'Oxfordshire', 'OX14 3QJ', 'Store'),
          ('Kitchen Store', 'Shelving in the kitchen pantry', '', 'Church Hall Kitchen', '12 Hall Lane', 'Oxford', 'Oxfordshire', 'OX1 1AA', 'Store'),
          ('The Village Green', 'Main outdoor event space', 'Bring gazebo weights if windy', 'Village Green', '', 'Oxford', 'Oxfordshire', 'OX1 2AB', 'Fetes'),
          ('Church Hall', 'Indoor hall with kitchen access', 'Use side entrance after 8am', 'Church Hall', '12 Hall Lane', 'Oxford', 'Oxfordshire', 'OX1 1AA', 'Fetes'),
          ('School Playing Field', 'Large field, parking on site', '', 'School Playing Fields', 'School Lane', 'Abingdon', 'Oxfordshire', 'OX14 1XY', 'Fetes')
      `,
      [],
      database,
    )

    await run(
      `
        INSERT INTO assets (name, category, quantity_total, quantity_available, location_id, notes) VALUES
          ('Folding Table 6ft', 'Furniture', 12, 12, 2, 'Heavy - two people to carry'),
          ('Folding Chair', 'Furniture', 60, 60, 2, ''),
          ('Gazebo 3x3m', 'Shelter', 4, 4, 2, 'Check all poles before use'),
          ('Bunting (10m)', 'Decoration', 20, 20, 1, 'Assorted colours'),
          ('Tablecloth (white)', 'Linen', 30, 30, 4, ''),
          ('Extension Lead 10m', 'Electrical', 8, 8, 1, 'PAT tested Jan 2026'),
          ('Float Cash Box', 'Equipment', 6, 6, 1, 'Combination 0000'),
          ('First Aid Kit', 'Safety', 3, 3, 1, 'Check expiry dates'),
          ('Raffle Drum', 'Equipment', 2, 2, 3, ''),
          ('Tea Urn (20L)', 'Equipment', 3, 3, 4, 'Descale after each use'),
          ('Signage A-Board', 'Stationery', 5, 5, 1, ''),
          ('Tombola Tickets (roll)', 'Stationery', 15, 15, 1, '')
      `,
      [],
      database,
    )

    await run(
      `
        INSERT INTO fetes (name, event_date, description, notes, status, created_by, location_id) VALUES
          ('Summer Fete 2026', '2026-07-18', 'Annual summer fundraiser on the green', 'Marquee setup starts at 10am', 'planned', 1, 5),
          ('Christmas Bazaar', '2026-12-05', 'Indoor craft and gift stalls', '', 'planned', 1, 6),
          ('Spring Open Day', '2026-04-12', 'Community open day', '', 'completed', 2, NULL)
      `,
      [],
      database,
    )

    await run(
      `
        INSERT INTO withdrawals (asset_id, fete_id, quantity, withdrawn_by, status, notes) VALUES
          (1, 1, 4, 3, 'out', 'Taken early for setup')
      `,
      [],
      database,
    )

    await run(
      'UPDATE assets SET quantity_available = quantity_available - 4 WHERE id = 1',
      [],
      database,
    )

    await run(
      `
        INSERT INTO fete_requirements (fete_id, asset_id, quantity_needed, notes) VALUES
          (1, 1, 8, 'For stalls'),
          (1, 2, 40, 'Seating'),
          (1, 3, 2, 'Shade for cake stall'),
          (1, 4, 10, 'Decorate fence line')
      `,
      [],
      database,
    )
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
