import sqlite3 from 'sqlite3'
import { resolveRuntimePaths } from './config.js'

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
        status       TEXT NOT NULL DEFAULT 'out',
        notes        TEXT NOT NULL DEFAULT ''
      )
    `,
    [],
    database,
  )

  await run(
    `
      CREATE TABLE IF NOT EXISTS fete_volunteers (
        id       INTEGER PRIMARY KEY AUTOINCREMENT,
        fete_id  INTEGER NOT NULL REFERENCES fetes(id) ON DELETE CASCADE,
        user_id  INTEGER NOT NULL REFERENCES fete_users(id),
        role     TEXT NOT NULL,
        notes    TEXT NOT NULL DEFAULT ''
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
  if (!feteExisting.has('volunteer_slots')) {
    await run('ALTER TABLE fetes ADD COLUMN volunteer_slots INTEGER NOT NULL DEFAULT 10;', [], database)
    console.log('Added missing fetes column: volunteer_slots')
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
      CREATE TABLE IF NOT EXISTS volunteer_booking_requests (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        fete_id     INTEGER NOT NULL REFERENCES fetes(id) ON DELETE CASCADE,
        name        TEXT NOT NULL,
        email       TEXT NOT NULL,
        status      TEXT NOT NULL DEFAULT 'pending',
        notes       TEXT NOT NULL DEFAULT '',
        created_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        reviewed_at TEXT,
        reviewed_by INTEGER REFERENCES fete_users(id) ON DELETE SET NULL,
        UNIQUE(fete_id, email)
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

  // Step 7: Add migration marker column to fete_volunteers if not already present
  const feteVolunteerColumns = await all<{ name: string }>('PRAGMA table_info(fete_volunteers);', [], database)
  const feteVolunteerExisting = new Set(feteVolunteerColumns.map((c) => c.name))
  if (!feteVolunteerExisting.has('migrated_at')) {
    await run('ALTER TABLE fete_volunteers ADD COLUMN migrated_at TEXT;', [], database)
    console.log('Added migration marker column: fete_volunteers.migrated_at')
  }

  // Step 9: Backfill unmigrated fete_volunteers rows into fete_volunteer_assignments
  const knownRoleKeys = new Set(roles.map(([key]) => key.toLowerCase()))

  function mapLegacyRole(rawRole: string): { role_key: string; role_other: string } {
    const normalised = rawRole.trim().toLowerCase()
    const matched = roles.find(([key]) => key.toLowerCase() === normalised)
    if (matched) return { role_key: matched[0], role_other: '' }
    return { role_key: 'Other', role_other: rawRole.trim() }
  }

  const unmigrated = await all<{ id: number; fete_id: number; user_id: number; role: string; notes: string }>(
    'SELECT id, fete_id, user_id, role, notes FROM fete_volunteers WHERE migrated_at IS NULL',
    [],
    database,
  )

  let backfillCount = 0
  let skippedCount = 0

  for (const row of unmigrated) {
    // Match fete_users to volunteers by email — the deterministic path
    const feteUser = await all<{ email: string }>(
      'SELECT email FROM fete_users WHERE id = ?',
      [row.user_id],
      database,
    )
    if (feteUser.length === 0) {
      skippedCount++
      continue
    }

    const volunteer = await all<{ id: number }>(
      'SELECT id FROM volunteers WHERE email = ?',
      [feteUser[0].email],
      database,
    )
    if (volunteer.length === 0) {
      // No matching volunteer record — ambiguous, leave unmigrated
      skippedCount++
      continue
    }

    const { role_key, role_other } = mapLegacyRole(row.role)

    try {
      await run(
        `INSERT OR IGNORE INTO fete_volunteer_assignments
          (fete_id, volunteer_id, role_key, role_other, notes, legacy_fete_volunteer_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [row.fete_id, volunteer[0].id, role_key, role_other, row.notes, row.id],
        database,
      )
      await run(
        'UPDATE fete_volunteers SET migrated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [row.id],
        database,
      )
      backfillCount++
    } catch {
      // Conflict (duplicate fete+volunteer pair) — mark migrated to avoid re-processing
      await run(
        'UPDATE fete_volunteers SET migrated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [row.id],
        database,
      )
      backfillCount++
    }
  }

  if (backfillCount > 0 || skippedCount > 0) {
    console.log(`fete_volunteers backfill: ${backfillCount} migrated, ${skippedCount} skipped (no matching volunteer record)`)
  }

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
          ('Loft', 'Above the main hall — ladder access', '', 'Village Community Centre', '4 Chapel Road', 'Abingdon', 'Oxfordshire', 'OX14 3QJ', 'Store'),
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
          ('Folding Table 6ft', 'Furniture', 12, 12, 2, 'Heavy — two people to carry'),
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
          ('Summer Fete 2026', '2026-07-18', 'Annual summer fundraiser on the green', 'Need extra volunteers at 10am', 'planned', 1, 5),
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
        INSERT INTO fete_volunteers (fete_id, user_id, role, notes) VALUES
          (1, 3, 'Stall Lead', 'Tombola stall'),
          (1, 4, 'Setup Crew', ''),
          (2, 3, 'Helper', '')
      `,
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

    await run(
      `
        INSERT INTO volunteers (
          name,
          email,
          address_line1,
          address_line2,
          town_city,
          county,
          postcode,
          phone_home,
          phone_mobile,
          skills,
          notes
        ) VALUES
          ('Eve Evans', 'eve.evans@example.org', '7 High Street', '', 'Oxford', 'Oxfordshire', 'OX1 4AB', '01865 123456', '07700 900111', 'Baking, till operation, first aid', 'Prefers morning shifts.'),
          ('Frank Foster', 'frank.foster@example.org', 'Flat 2, 18 River Road', '', 'Abingdon', 'Oxfordshire', 'OX14 5CD', '01235 998877', '07700 900222', 'Heavy lifting, setup crew', '')
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
