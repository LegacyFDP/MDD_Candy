const sqlite3 = require('sqlite3')
const path = require('node:path')
const fs = require('node:fs')

const here = __dirname
// DB_PATH mirrors server/src/db.ts so containerized first-run init writes to
// the same mounted file the server will open.
const dbPath = process.env.DB_PATH
  ? path.resolve(process.env.DB_PATH)
  : path.resolve(here, '..', 'MDD_Candy.db')

function openDb() {
  return new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error('Database connection error:', err)
      process.exit(1)
    }
  })
}

let db = openDb()

async function runSQL(sql) {
  return new Promise((resolve, reject) => {
    db.exec(sql, (err) => {
      if (err) reject(err)
      else resolve()
    })
  })
}

function tableHasRows(table) {
  return new Promise((resolve, reject) => {
    db.get(`SELECT COUNT(*) AS c FROM ${table}`, [], (err, row) => {
      if (err) resolve(false) // table doesn't exist yet
      else resolve(row.c > 0)
    })
  })
}

function isCorruptError(err) {
  const msg = String((err && err.message) || err || '')
  return msg.includes('SQLITE_CORRUPT') || msg.includes('database disk image is malformed')
}

function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err)
      else resolve(row)
    })
  })
}

function closeDb() {
  return new Promise((resolve, reject) => {
    db.close((err) => {
      if (err) reject(err)
      else resolve()
    })
  })
}

async function guardAgainstCorruptDb() {
  if (!fs.existsSync(dbPath)) return

  try {
    await dbGet('PRAGMA integrity_check;')
  } catch (err) {
    if (!isCorruptError(err)) throw err

    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    const backupPath = `${dbPath}.corrupt-${stamp}.bak`

    console.warn(`⚠ Detected corrupt SQLite database at ${dbPath}`)
    await closeDb()
    fs.copyFileSync(dbPath, backupPath)
    fs.unlinkSync(dbPath)
    console.warn(`⚠ Backed up corrupt DB to ${backupPath}`)

    db = openDb()
  }
}

async function init() {
  try {
    await guardAgainstCorruptDb()

    if (await tableHasRows('fete_users')) {
      console.log(`Database at ${dbPath} already has data — skipping (this script is one-time setup only).`)
      await closeDb()
      return
    }

    console.log(`Initializing SQLite database at ${dbPath}...`)

    // Create schema directly for SQLite
    const schema = `
CREATE TABLE IF NOT EXISTS fete_users (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT        NOT NULL,
  email      TEXT        NOT NULL UNIQUE,
  role       TEXT        NOT NULL DEFAULT 'user',
  pin        TEXT        NOT NULL,
  created_at TEXT        NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS store_locations (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  notes       TEXT NOT NULL DEFAULT '',
  address_line1 TEXT NOT NULL DEFAULT '',
  address_line2 TEXT NOT NULL DEFAULT '',
  town_city     TEXT NOT NULL DEFAULT '',
  county        TEXT NOT NULL DEFAULT '',
  postcode      TEXT NOT NULL DEFAULT '',
  location_type TEXT NOT NULL DEFAULT 'Store'
);

CREATE TABLE IF NOT EXISTS assets (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  name               TEXT        NOT NULL,
  category           TEXT        NOT NULL DEFAULT 'Other',
  quantity_total     INTEGER     NOT NULL DEFAULT 0,
  quantity_available INTEGER     NOT NULL DEFAULT 0,
  location_id        INTEGER     REFERENCES store_locations(id) ON DELETE SET NULL,
  notes              TEXT        NOT NULL DEFAULT '',
  created_at         TEXT        NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS fetes (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT        NOT NULL,
  event_date  DATE,
  description TEXT        NOT NULL DEFAULT '',
  notes       TEXT        NOT NULL DEFAULT '',
  status      TEXT        NOT NULL DEFAULT 'planned',
  created_by  INTEGER     REFERENCES fete_users(id) ON DELETE SET NULL,
  location_id INTEGER     REFERENCES store_locations(id) ON DELETE SET NULL,
  created_at  TEXT        NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS withdrawals (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  asset_id     INTEGER     NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  fete_id      INTEGER     REFERENCES fetes(id) ON DELETE SET NULL,
  quantity     INTEGER     NOT NULL,
  withdrawn_by INTEGER     NOT NULL REFERENCES fete_users(id),
  returned_by  INTEGER     REFERENCES fete_users(id),
  withdrawn_at TEXT        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status       TEXT        NOT NULL DEFAULT 'out',
  notes        TEXT        NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS fete_volunteers (
  id   INTEGER PRIMARY KEY AUTOINCREMENT,
  fete_id INTEGER NOT NULL REFERENCES fetes(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES fete_users(id),
  role TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS fete_requirements (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  fete_id          INTEGER NOT NULL REFERENCES fetes(id) ON DELETE CASCADE,
  asset_id         INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  quantity_needed  INTEGER NOT NULL,
  notes            TEXT    NOT NULL DEFAULT ''
);
    `

    await runSQL(schema)
    console.log('✓ Schema created')

    // Seed data
    const seed = `
INSERT INTO fete_users (name, email, role, pin) VALUES
  ('Alice Adams',  'alice@charity.org', 'admin', '1234'),
  ('Bob Brown',    'bob@charity.org',   'admin', '2345'),
  ('Carol Clarke', 'carol@charity.org', 'user',  '3456'),
  ('Dan Davies',   'dan@charity.org',   'user',  '4567');

INSERT INTO store_locations (
  name,
  description,
  address_line1,
  address_line2,
  town_city,
  county,
  postcode,
  location_type
) VALUES
  ('Main Cupboard', 'Hallway cupboard by the office', 'St Mary''s Church Hall', '12 Hall Lane', 'Oxford', 'Oxfordshire', 'OX1 1AA', 'Store'),
  ('Garage',        'Lock-up garage behind the hall', 'Parish Storage Garage', 'Rear of 28 Market Street', 'Oxford', 'Oxfordshire', 'OX2 7BG', 'Store'),
  ('Loft',          'Above the main hall — ladder access', 'Village Community Centre', '4 Chapel Road', 'Abingdon', 'Oxfordshire', 'OX14 3QJ', 'Store'),
  ('Kitchen Store', 'Shelving in the kitchen pantry', 'Church Hall Kitchen', '12 Hall Lane', 'Oxford', 'Oxfordshire', 'OX1 1AA', 'Store'),
  ('The Village Green', 'Main outdoor event space', 'Village Green', '', 'Oxford', 'Oxfordshire', 'OX1 2AB', 'Fetes'),
  ('Church Hall', 'Indoor hall with kitchen access', 'Church Hall', '12 Hall Lane', 'Oxford', 'Oxfordshire', 'OX1 1AA', 'Fetes'),
  ('School Playing Field', 'Large field, parking on site', 'School Playing Fields', 'School Lane', 'Abingdon', 'Oxfordshire', 'OX14 1XY', 'Fetes');

INSERT INTO assets (name, category, quantity_total, quantity_available, location_id, notes) VALUES
  ('Folding Table 6ft',      'Furniture',   12, 12, 2, 'Heavy — two people to carry'),
  ('Folding Chair',          'Furniture',   60, 60, 2, ''),
  ('Gazebo 3x3m',            'Shelter',      4,  4, 2, 'Check all poles before use'),
  ('Bunting (10m)',          'Decoration',  20, 20, 1, 'Assorted colours'),
  ('Tablecloth (white)',     'Linen',       30, 30, 4, ''),
  ('Extension Lead 10m',     'Electrical',   8,  8, 1, 'PAT tested Jan 2026'),
  ('Float Cash Box',         'Equipment',    6,  6, 1, 'Combination 0000'),
  ('First Aid Kit',          'Safety',       3,  3, 1, 'Check expiry dates'),
  ('Raffle Drum',            'Equipment',    2,  2, 3, ''),
  ('Tea Urn (20L)',          'Equipment',    3,  3, 4, 'Descale after each use'),
  ('Signage A-Board',        'Stationery',   5,  5, 1, ''),
  ('Tombola Tickets (roll)', 'Stationery',  15, 15, 1, '');

INSERT INTO fetes (name, event_date, description, status, created_by, location_id) VALUES
  ('Summer Fete 2026',  '2026-07-18', 'Annual summer fundraiser on the green', 'planned',   1, 5),
  ('Christmas Bazaar',  '2026-12-05', 'Indoor craft and gift stalls',          'planned',   1, 6),
  ('Spring Open Day',   '2026-04-12', 'Community open day',                     'completed', 2, NULL);

INSERT INTO withdrawals (asset_id, fete_id, quantity, withdrawn_by, status, notes) VALUES
  (1, 1, 4, 3, 'out', 'Taken early for setup');

UPDATE assets SET quantity_available = quantity_available - 4 WHERE id = 1;

INSERT INTO fete_volunteers (fete_id, user_id, role, notes) VALUES
  (1, 3, 'Stall Lead', 'Tombola stall'),
  (1, 4, 'Setup Crew', ''),
  (2, 3, 'Helper',     '');

INSERT INTO fete_requirements (fete_id, asset_id, quantity_needed, notes) VALUES
  (1, 1, 8,  'For stalls'),
  (1, 2, 40, 'Seating'),
  (1, 3, 2,  'Shade for cake stall'),
  (1, 4, 10, 'Decorate fence line');
    `
    
    await runSQL(seed)
    console.log('✓ Seed data loaded')

    console.log('✅ Database initialized successfully!')
    await closeDb()
  } catch (err) {
    console.error('❌ Initialization failed:', err.message)
    db.close((closeErr) => {
      if (closeErr) console.error('Close error:', closeErr)
      process.exit(1)
    })
  }
}

init()
