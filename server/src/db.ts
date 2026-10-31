import sqlite3 from 'sqlite3'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { resolveRuntimePaths } from './config.ts'

const { dbPath } = resolveRuntimePaths()

if (!existsSync(dbPath)) {
  throw new Error(`SQLite database not found at ${dbPath}. Run "npm run db:init" only for a new database.`)
}

export const activeDatabaseFile = path.basename(dbPath)

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
      CREATE TABLE IF NOT EXISTS people (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        name       TEXT NOT NULL,
        email      TEXT NOT NULL DEFAULT '',
        phone      TEXT NOT NULL DEFAULT '',
        notes      TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `,
    [],
    database,
  )
  await run(
    `
      CREATE TABLE IF NOT EXISTS person_roles (
        person_id INTEGER NOT NULL REFERENCES people(id) ON DELETE CASCADE,
        role      TEXT NOT NULL,
        PRIMARY KEY (person_id, role)
      )
    `,
    [],
    database,
  )

  // Name and contact details live on people; email stays here as the login name.
  // The permission level is worked out from person_roles (see accountRoleSql).
  await run(
    `
      CREATE TABLE IF NOT EXISTS fete_users (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        person_id  INTEGER REFERENCES people(id) ON DELETE SET NULL,
        email      TEXT NOT NULL UNIQUE,
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
        location_type TEXT NOT NULL DEFAULT 'Store',
        archived_at   TEXT,
        archived_by   INTEGER REFERENCES fete_users(id) ON DELETE SET NULL
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
        category_id        INTEGER REFERENCES asset_categories(id),
        quantity_total     INTEGER NOT NULL DEFAULT 0,
        quantity_available INTEGER NOT NULL DEFAULT 0,
        location_id        INTEGER REFERENCES store_locations(id) ON DELETE SET NULL,
        storage_area_id    INTEGER REFERENCES storage_areas(id) ON DELETE SET NULL,
        notes              TEXT NOT NULL DEFAULT '',
        created_at         TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `,
    [],
    database,
  )

  await run(
    `
      CREATE TABLE IF NOT EXISTS storage_areas (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        location_id   INTEGER NOT NULL REFERENCES store_locations(id) ON DELETE CASCADE,
        name          TEXT NOT NULL,
        description   TEXT NOT NULL DEFAULT '',
        notes         TEXT NOT NULL DEFAULT '',
        created_at    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `,
    [],
    database,
  )

  await run(
    `
      CREATE TABLE IF NOT EXISTS asset_categories (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        name       TEXT NOT NULL COLLATE NOCASE UNIQUE,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
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
        archived_at TEXT,
        archived_by INTEGER REFERENCES fete_users(id) ON DELETE SET NULL,
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
    { name: 'archived_at', sqlType: 'TEXT' },
    { name: 'archived_by', sqlType: 'INTEGER REFERENCES fete_users(id) ON DELETE SET NULL' },
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

  const assetColumns = await all<{ name: string }>('PRAGMA table_info(assets);', [], database)
  if (!assetColumns.some((column) => column.name === 'storage_area_id')) {
    await run('ALTER TABLE assets ADD COLUMN storage_area_id INTEGER REFERENCES storage_areas(id) ON DELETE SET NULL;', [], database)
    console.log('Added missing assets column: storage_area_id')
  }

  const feteColumns = await all<{ name: string }>('PRAGMA table_info(fetes);', [], database)
  const feteExisting = new Set(feteColumns.map((column) => column.name))
  if (!feteExisting.has('notes')) {
    await run("ALTER TABLE fetes ADD COLUMN notes TEXT NOT NULL DEFAULT '';", [], database)
    console.log('Added missing fetes column: notes')
  }
  if (!feteExisting.has('archived_at')) {
    await run('ALTER TABLE fetes ADD COLUMN archived_at TEXT;', [], database)
    console.log('Added missing fetes column: archived_at')
  }
  if (!feteExisting.has('archived_by')) {
    await run('ALTER TABLE fetes ADD COLUMN archived_by INTEGER REFERENCES fete_users(id) ON DELETE SET NULL;', [], database)
    console.log('Added missing fetes column: archived_by')
  }

  const withdrawalColumns = await all<{ name: string }>('PRAGMA table_info(withdrawals);', [], database)
  const withdrawalExisting = new Set(withdrawalColumns.map((column) => column.name))
  if (!withdrawalExisting.has('returned_at')) {
    await run('ALTER TABLE withdrawals ADD COLUMN returned_at TEXT;', [], database)
    console.log('Added missing withdrawals column: returned_at')
  }

  await run(
    "UPDATE store_locations SET location_type = 'Store' WHERE location_type IS NULL OR TRIM(location_type) = ''",
    [],
    database,
  )

  await run(
    `
      INSERT OR IGNORE INTO asset_categories (name) VALUES
        ('Decoration'), ('Electrical'), ('Equipment'), ('Furniture'), ('Linen'),
        ('Safety'), ('Shelter'), ('Stationery'), ('Toys'), ('Other')
    `,
    [],
    database,
  )
  await migrateAssetCategoryToId(database)

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
        person_id  INTEGER REFERENCES people(id) ON DELETE SET NULL,
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

  await run(
    `
      CREATE TABLE IF NOT EXISTS volunteer_roles (
        volunteer_id INTEGER NOT NULL REFERENCES fete_volunteers(id) ON DELETE CASCADE,
        role         TEXT NOT NULL,
        PRIMARY KEY (volunteer_id, role)
      )
    `,
    [],
    database,
  )

  await run(
    `
      CREATE TABLE IF NOT EXISTS volunteer_shift_roles (
        shift_id INTEGER NOT NULL REFERENCES volunteer_shifts(id) ON DELETE CASCADE,
        role     TEXT NOT NULL,
        PRIMARY KEY (shift_id, role)
      )
    `,
    [],
    database,
  )

  await run(
    `
      CREATE TABLE IF NOT EXISTS fete_contacts (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        person_id  INTEGER REFERENCES people(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `,
    [],
    database,
  )

  await run(
    `
      CREATE TABLE IF NOT EXISTS fete_contact_events (
        contact_id INTEGER NOT NULL REFERENCES fete_contacts(id) ON DELETE CASCADE,
        fete_id    INTEGER NOT NULL REFERENCES fetes(id) ON DELETE CASCADE,
        PRIMARY KEY (contact_id, fete_id)
      )
    `,
    [],
    database,
  )

  await migrateSingleRoleColumn('fete_volunteers', 'volunteer_roles', 'volunteer_id', database)
  await migrateSingleRoleColumn('volunteer_shifts', 'volunteer_shift_roles', 'shift_id', database)

  const shiftColumns = await all<{ name: string }>('PRAGMA table_info(volunteer_shifts);', [], database)
  const shiftExisting = new Set(shiftColumns.map((column) => column.name))
  if (!shiftExisting.has('start_date')) {
    await run('ALTER TABLE volunteer_shifts ADD COLUMN start_date TEXT NOT NULL DEFAULT CURRENT_DATE;', [], database)
  }
  if (!shiftExisting.has('end_date')) {
    await run('ALTER TABLE volunteer_shifts ADD COLUMN end_date TEXT NOT NULL DEFAULT CURRENT_DATE;', [], database)
  }

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
  } else {
    await run(
      `
        UPDATE volunteer_shifts
        SET start_date = COALESCE(start_date, CURRENT_DATE),
            end_date = COALESCE(end_date, CURRENT_DATE)
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
    const seedUsers = [
      ['Alice Adams', 'alice@charity.org', 'admin', '1234'],
      ['Bob Brown', 'bob@charity.org', 'admin', '2345'],
      ['Carol Clarke', 'carol@charity.org', 'user', '3456'],
      ['Dan Davies', 'dan@charity.org', 'user', '4567'],
    ] as const
    for (const [name, email, role, pin] of seedUsers) {
      const person = await runWithMeta('INSERT INTO people (name, email) VALUES ($1, $2)', [name, email], database)
      await run('INSERT INTO person_roles (person_id, role) VALUES ($1, $2)', [person.lastID, ACCOUNT_ROLE_LABELS[role]], database)
      await run(
        'INSERT INTO fete_users (person_id, email, pin) VALUES ($1, $2, $3)',
        [person.lastID, email, pin],
        database,
      )
    }

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
        INSERT INTO assets (name, category_id, quantity_total, quantity_available, location_id, notes)
        SELECT seed.column1, c.id, seed.column3, seed.column4, seed.column5, seed.column6
        FROM (VALUES
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
        ) AS seed
        JOIN asset_categories c ON c.name = seed.column2
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

  await ensurePeopleSchema(database)
  await dropCopiedPersonColumns(database)
  await dropStoredAccountRole(database)
  await deleteOrphanedAssetRows(database)
}

/**
 * fete_users.role stored the permission level that savePerson worked out from
 * person_roles. It is now calculated on read (accountRoleSql in
 * backend/fete/personRecords.ts, which this CASE must match). Before dropping
 * the column, give any person whose roles disagree with their stored level the
 * matching role, so nobody loses access.
 */
async function dropStoredAccountRole(database: sqlite3.Database): Promise<void> {
  const columns = await all<{ name: string }>('PRAGMA table_info(fete_users);', [], database)
  if (!columns.some(column => column.name === 'role')) return

  const mismatched = await all<{ id: number; person_id: number; role: string }>(
    `
      SELECT u.id, u.person_id, u.role FROM fete_users u
      WHERE u.person_id IS NOT NULL AND u.role <> (
        SELECT CASE
          WHEN SUM(role = 'Admin') > 0 THEN 'admin'
          WHEN SUM(role = 'Store Keeper') > 0 THEN 'store keeper'
          ELSE 'user'
        END FROM person_roles WHERE person_id = u.person_id
      )
    `,
    [],
    database,
  )

  await run('BEGIN', [], database)
  try {
    for (const user of mismatched) {
      const label = ACCOUNT_ROLE_LABELS[user.role] ?? 'User'
      await run('INSERT OR IGNORE INTO person_roles (person_id, role) VALUES ($1, $2)', [user.person_id, label], database)
      console.log(`Login ${user.id} was stored as '${user.role}' but its person lacked that role; added '${label}'`)
    }
    await run('ALTER TABLE fete_users DROP COLUMN role;', [], database)
    await run('COMMIT', [], database)
    console.log('Dropped fete_users.role (now worked out from person_roles)')
  } catch (error) {
    await run('ROLLBACK', [], database)
    throw error
  }
}

/**
 * Foreign keys are not enforced on this connection, so deleting an asset or
 * fete has left rows pointing at ids that no longer exist. Apply what the
 * ON DELETE rules would have done.
 */
async function deleteOrphanedAssetRows(database: sqlite3.Database): Promise<void> {
  const cleanups = [
    ['withdrawals with a missing asset', 'DELETE FROM withdrawals WHERE asset_id NOT IN (SELECT id FROM assets)'],
    ['withdrawals with a missing fete', 'UPDATE withdrawals SET fete_id = NULL WHERE fete_id IS NOT NULL AND fete_id NOT IN (SELECT id FROM fetes)'],
    ['fete requirements with a missing asset', 'DELETE FROM fete_requirements WHERE asset_id NOT IN (SELECT id FROM assets)'],
    ['fete requirements with a missing fete', 'DELETE FROM fete_requirements WHERE fete_id NOT IN (SELECT id FROM fetes)'],
  ] as const
  for (const [label, sql] of cleanups) {
    const { changes } = await runWithMeta(sql, [], database)
    if (changes > 0) console.log(`Cleaned up ${changes} ${label}`)
  }
}

/**
 * fete_users, fete_volunteers and fete_contacts kept their own copies of the
 * person's details after people was introduced. Once every row is linked to a
 * person, drop the copies. fete_users keeps email as the login name.
 */
async function dropCopiedPersonColumns(database: sqlite3.Database): Promise<void> {
  const copied = {
    fete_users: ['name'],
    fete_volunteers: ['name', 'email', 'phone', 'notes'],
    fete_contacts: ['name', 'email', 'phone', 'notes'],
  } as const

  for (const [table, dropColumns] of Object.entries(copied)) {
    const existing = new Set((await all<{ name: string }>(`PRAGMA table_info(${table});`, [], database)).map(c => c.name))
    const toDrop = dropColumns.filter(column => existing.has(column))
    if (toDrop.length === 0) continue

    const unlinked = await all<{ count: number }>(`SELECT COUNT(*) AS count FROM ${table} WHERE person_id IS NULL`, [], database)
    if ((unlinked[0]?.count ?? 0) > 0) {
      throw new Error(`Cannot drop ${table} person columns: ${unlinked[0]!.count} rows are not linked to a person`)
    }

    await run('BEGIN', [], database)
    try {
      for (const column of toDrop) await run(`ALTER TABLE ${table} DROP COLUMN ${column};`, [], database)
      await run('COMMIT', [], database)
      console.log(`Dropped ${table} columns now held on people: ${toDrop.join(', ')}`)
    } catch (error) {
      await run('ROLLBACK', [], database)
      throw error
    }
  }
}

/**
 * assets.category used to hold the category name as free text, duplicating
 * asset_categories. Replace it with a category_id foreign key: register any
 * names not yet in asset_categories, point each asset at its row, then drop
 * the text column. Runs once; databases without the old column are skipped.
 */
async function migrateAssetCategoryToId(database: sqlite3.Database): Promise<void> {
  const columns = await all<{ name: string }>('PRAGMA table_info(assets);', [], database)
  if (!columns.some(column => column.name === 'category')) return

  await run('BEGIN', [], database)
  try {
    await run(
      `
        INSERT OR IGNORE INTO asset_categories (name)
        SELECT DISTINCT TRIM(category) FROM assets WHERE TRIM(category) <> ''
      `,
      [],
      database,
    )
    if (!columns.some(column => column.name === 'category_id')) {
      await run('ALTER TABLE assets ADD COLUMN category_id INTEGER REFERENCES asset_categories(id);', [], database)
    }
    await run(
      `
        UPDATE assets SET category_id = (
          SELECT c.id FROM asset_categories c
          WHERE c.name = COALESCE(NULLIF(TRIM(assets.category), ''), 'Other')
        )
      `,
      [],
      database,
    )
    await run('ALTER TABLE assets DROP COLUMN category;', [], database)
    await run('COMMIT', [], database)
    console.log('Migrated assets.category to assets.category_id')
  } catch (error) {
    await run('ROLLBACK', [], database)
    throw error
  }
}

/**
 * fete_volunteers.role and volunteer_shifts.role held a single role that is
 * also stored in the matching link table. Copy any value missing from the
 * link table, then drop the column. Runs once per table.
 */
async function migrateSingleRoleColumn(
  table: 'fete_volunteers' | 'volunteer_shifts',
  roleTable: 'volunteer_roles' | 'volunteer_shift_roles',
  keyColumn: 'volunteer_id' | 'shift_id',
  database: sqlite3.Database,
): Promise<void> {
  const columns = await all<{ name: string }>(`PRAGMA table_info(${table});`, [], database)
  if (!columns.some(column => column.name === 'role')) return

  await run('BEGIN', [], database)
  try {
    await run(
      `INSERT OR IGNORE INTO ${roleTable} (${keyColumn}, role) SELECT id, role FROM ${table} WHERE TRIM(role) <> ''`,
      [],
      database,
    )
    await run(`ALTER TABLE ${table} DROP COLUMN role;`, [], database)
    await run('COMMIT', [], database)
    console.log(`Dropped ${table}.role (now only in ${roleTable})`)
  } catch (error) {
    await run('ROLLBACK', [], database)
    throw error
  }
}

const ACCOUNT_ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  'store keeper': 'Store Keeper',
  user: 'User',
}

/**
 * One `people` row per human, with any number of `person_roles`. The
 * fete_users / fete_volunteers / fete_contacts tables stay as per-role detail
 * records (other tables reference them) and link back through person_id.
 * Databases from before people existed have their records linked once;
 * records that share a name and email are merged into the same person,
 * everything else becomes its own person. dropCopiedPersonColumns then
 * removes the old detail columns, after which there is nothing left to link.
 */
async function ensurePeopleSchema(database: sqlite3.Database): Promise<void> {
  const legacyTables = new Set<string>()
  for (const table of ['fete_users', 'fete_volunteers', 'fete_contacts']) {
    const columns = await all<{ name: string }>(`PRAGMA table_info(${table});`, [], database)
    if (!columns.some(column => column.name === 'person_id')) {
      await run(`ALTER TABLE ${table} ADD COLUMN person_id INTEGER REFERENCES people(id) ON DELETE SET NULL;`, [], database)
    }
    if (columns.some(column => column.name === 'name')) legacyTables.add(table)
  }
  if (legacyTables.size === 0) return

  async function createPerson(name: string, email: string, phone: string, notes: string, role: string) {
    const created = await runWithMeta(
      'INSERT INTO people (name, email, phone, notes) VALUES ($1, $2, $3, $4)',
      [name, email, phone, notes],
      database,
    )
    await run('INSERT OR IGNORE INTO person_roles (person_id, role) VALUES ($1, $2)', [created.lastID, role], database)
    return created.lastID
  }

  async function linkOrCreate(
    table: 'fete_volunteers' | 'fete_contacts',
    row: { id: number; name: string; email: string | null; phone: string | null; notes: string | null },
    role: string,
  ) {
    const email = (row.email ?? '').trim()
    const phone = (row.phone ?? '').trim()
    const notes = (row.notes ?? '').trim()
    let personId: number | undefined
    if (email) {
      const match = await all<{ id: number }>(
        `
          SELECT p.id FROM people p
          WHERE LOWER(TRIM(p.name)) = LOWER(TRIM($1)) AND LOWER(TRIM(p.email)) = LOWER($2)
            AND NOT EXISTS (SELECT 1 FROM ${table} t WHERE t.person_id = p.id)
          ORDER BY p.id LIMIT 1
        `,
        [row.name, email],
        database,
      )
      personId = match[0]?.id
    }
    if (personId) {
      await run('INSERT OR IGNORE INTO person_roles (person_id, role) VALUES ($1, $2)', [personId, role], database)
      await run(
        `UPDATE people SET phone = CASE WHEN phone = '' THEN $1 ELSE phone END,
                           notes = CASE WHEN notes = '' THEN $2 ELSE notes END WHERE id = $3`,
        [phone, notes, personId],
        database,
      )
    } else {
      personId = await createPerson(row.name.trim(), email, phone, notes, role)
    }
    await run(`UPDATE ${table} SET person_id = $1 WHERE id = $2`, [personId, row.id], database)
  }

  if (legacyTables.has('fete_users')) {
    const users = await all<{ id: number; name: string; email: string; role: string }>(
      'SELECT id, name, email, role FROM fete_users WHERE person_id IS NULL ORDER BY id',
      [],
      database,
    )
    for (const user of users) {
      const personId = await createPerson(user.name.trim(), user.email.trim(), '', '', ACCOUNT_ROLE_LABELS[user.role] ?? 'User')
      await run('UPDATE fete_users SET person_id = $1 WHERE id = $2', [personId, user.id], database)
    }
  }

  if (legacyTables.has('fete_volunteers')) {
    const volunteers = await all<{ id: number; name: string; email: string | null; phone: string | null; notes: string | null }>(
      'SELECT id, name, email, phone, notes FROM fete_volunteers WHERE person_id IS NULL ORDER BY id',
      [],
      database,
    )
    for (const volunteer of volunteers) await linkOrCreate('fete_volunteers', volunteer, 'Volunteer')
  }

  if (legacyTables.has('fete_contacts')) {
    const contacts = await all<{ id: number; name: string; email: string | null; phone: string | null; notes: string | null }>(
      'SELECT id, name, email, phone, notes FROM fete_contacts WHERE person_id IS NULL ORDER BY id',
      [],
      database,
    )
    for (const contact of contacts) await linkOrCreate('fete_contacts', contact, 'Contact')
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
