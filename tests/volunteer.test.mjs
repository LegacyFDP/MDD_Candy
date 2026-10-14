import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const backendDir = path.resolve('backend/fete')

test('volunteer backend and schema support exist', () => {
  assert.ok(fs.existsSync(path.join(backendDir, 'getVolunteers.ts')), 'Missing getVolunteers.ts')
  assert.ok(fs.existsSync(path.join(backendDir, 'saveVolunteer.ts')), 'Missing saveVolunteer.ts')
  assert.ok(fs.existsSync(path.join(backendDir, 'deleteVolunteer.ts')), 'Missing deleteVolunteer.ts')
  assert.ok(fs.existsSync(path.resolve('frontend/pages/VolunteersPage.tsx')), 'Missing VolunteersPage.tsx')
})

test('Dashboard properly wires useGetVolunteerShifts and Users icon', () => {
  const dashboardSrc = fs.readFileSync(path.resolve('frontend/pages/Dashboard.tsx'), 'utf8')
  assert.match(dashboardSrc, /useGetVolunteerShifts\(\)/, 'Dashboard should call useGetVolunteerShifts()')
  assert.match(dashboardSrc, /loadVolunteerShifts\(\{\}\)/, 'Dashboard should load volunteer shifts on mount')
  assert.match(dashboardSrc, /import\s*\{[^}]*\bUsers\b[^}]*\}\s*from\s*['"]lucide-react['"]/, 'Dashboard should import Users icon')
})

test('getVolunteerShifts avoids PostgreSQL-only casts and missing shift_date column', () => {
  const shiftSrc = fs.readFileSync(path.join(backendDir, 'getVolunteerShifts.ts'), 'utf8')
  assert.doesNotMatch(shiftSrc, /::int/, 'Should not use Postgres ::int cast in SQLite queries')
  assert.doesNotMatch(shiftSrc, /vs\.shift_date/, 'Should not reference nonexistent vs.shift_date column')
})

test('user list endpoints do not leak plaintext PINs', () => {
  const getUsersSrc = fs.readFileSync(path.join(backendDir, 'getUsers.ts'), 'utf8')
  const getUsersWithFetesSrc = fs.readFileSync(path.join(backendDir, 'getUsersWithFetes.ts'), 'utf8')
  assert.doesNotMatch(getUsersSrc, /\bpin\b/i, 'getUsers should not select pin')
  assert.doesNotMatch(getUsersWithFetesSrc, /\bu\.pin\b/i, 'getUsersWithFetes should not select u.pin')
})

test('backend handlers enforce stock reservations, return rules, and fete allocations on SQLite', async () => {
  const { DatabaseSync } = await import('node:sqlite')
  const sqlite = new DatabaseSync(':memory:')
  sqlite.exec('PRAGMA foreign_keys = ON;')

  let txChain = Promise.resolve()
  globalThis.retoolDb = {
    async query(text, params = []) {
      const sqliteParams = []
      const sqliteText = text.replace(/\$(\d+)(?:::[a-zA-Z_][a-zA-Z0-9_]*)?/g, (_m, idx) => {
        sqliteParams.push(params[Number(idx) - 1])
        return '?'
      })
      const trimmed = sqliteText.trim()
      const stmt = sqlite.prepare(trimmed)
      if (/^(SELECT|WITH|PRAGMA)\b/i.test(trimmed)) {
        return { data: stmt.all(...sqliteParams) }
      }
      stmt.run(...sqliteParams)
      return { data: [] }
    },
    async transaction(fn) {
      const runTx = txChain.then(async () => {
        sqlite.exec('BEGIN IMMEDIATE TRANSACTION')
        try {
          const res = await fn()
          sqlite.exec('COMMIT')
          return res
        } catch (err) {
          try { sqlite.exec('ROLLBACK') } catch {}
          throw err
        }
      })
      txChain = runTx.then(() => undefined, () => undefined)
      return runTx
    },
  }

  sqlite.exec(`
    CREATE TABLE fete_users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, role TEXT NOT NULL DEFAULT 'user', pin TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE assets (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, category TEXT NOT NULL DEFAULT 'Other', quantity_total INTEGER NOT NULL DEFAULT 0, quantity_available INTEGER NOT NULL DEFAULT 0, location_id INTEGER, storage_area_id INTEGER, notes TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE fetes (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, event_date DATE, description TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'planned', created_by INTEGER, location_id INTEGER, archived_at TEXT, archived_by INTEGER, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE withdrawals (id INTEGER PRIMARY KEY AUTOINCREMENT, asset_id INTEGER NOT NULL, fete_id INTEGER, quantity INTEGER NOT NULL, withdrawn_by INTEGER NOT NULL, returned_by INTEGER, withdrawn_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, returned_at TEXT, status TEXT NOT NULL DEFAULT 'out', notes TEXT NOT NULL DEFAULT '');
    CREATE TABLE fete_volunteers (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT, phone TEXT, role TEXT NOT NULL DEFAULT 'Helper', notes TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE volunteer_shifts (id INTEGER PRIMARY KEY AUTOINCREMENT, volunteer_id INTEGER NOT NULL, fete_id INTEGER, role TEXT NOT NULL DEFAULT 'Helper', start_date TEXT NOT NULL, end_date TEXT NOT NULL, start_time TEXT NOT NULL, end_time TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    INSERT INTO fete_users (name, email, role, pin) VALUES ('Alice Adams', 'alice@charity.org', 'admin', '1234');
    INSERT INTO assets (name, category, quantity_total, quantity_available, notes) VALUES ('Gazebo 3x3m', 'Shelter', 4, 4, '');
    INSERT INTO fetes (name, event_date, status, created_by) VALUES ('Summer Fete 2026', '2026-07-18', 'planned', 1);
  `)

  const { default: getVolunteerShifts } = await import('../backend/fete/getVolunteerShifts.ts')
  const { default: saveVolunteer } = await import('../backend/fete/saveVolunteer.ts')
  const { default: getVolunteers } = await import('../backend/fete/getVolunteers.ts')
  const { default: saveVolunteerShift } = await import('../backend/fete/saveVolunteerShift.ts')
  const { default: bookAsset } = await import('../backend/fete/bookAsset.ts')
  const { default: withdrawAsset } = await import('../backend/fete/withdrawAsset.ts')
  const { default: returnAsset } = await import('../backend/fete/returnAsset.ts')
  const { default: deleteAsset } = await import('../backend/fete/deleteAsset.ts')
  const { default: getUsersWithFetes } = await import('../backend/fete/getUsersWithFetes.ts')

  await saveVolunteer({ params: { name: 'Jane Doe', role: 'Helper' }, user: null })
  const volunteers = await getVolunteers({ params: {}, user: null })
  assert.equal(volunteers.length, 1)

  await saveVolunteerShift({
    params: {
      volunteer_id: volunteers[0].id,
      fete_id: 1,
      role: 'Helper',
      start_date: '2026-07-18',
      end_date: '2026-07-18',
      start_time: '09:00',
      end_time: '12:00',
    },
    user: null,
  })

  const shifts = await getVolunteerShifts({ params: { fete_id: 1 }, user: null })
  assert.equal(shifts.length, 1)
  assert.equal(shifts[0].volunteer_name, 'Jane Doe')

  await bookAsset({
    params: { asset_id: 1, fete_id: 1, quantity: 2, booked_by: 1, notes: 'Reserve' },
    user: null,
  })

  await assert.rejects(
    () => withdrawAsset({
      params: { asset_id: 1, fete_id: 1, quantity: 3, withdrawn_by: 1, notes: 'Too many' },
      user: null,
    }),
    /Not enough unbooked stock available/,
  )

  await assert.rejects(
    () => deleteAsset({ params: { id: 1 }, user: null }),
    /Cannot delete an asset that is currently checked out or booked/,
  )

  const bookedRow = await globalThis.retoolDb.query(
    "SELECT id FROM withdrawals WHERE asset_id = 1 AND status = 'booked'",
  )
  await assert.rejects(
    () => returnAsset({
      params: { withdrawal_id: bookedRow.data[0].id, returned_by: 1, notes: '' },
      user: null,
    }),
    /Only items currently checked out can be returned/,
  )

  const usersWithFetes = await getUsersWithFetes({ params: {}, user: null })
  assert.ok(usersWithFetes.length > 0)
  assert.equal('pin' in usersWithFetes[0], false)
  const alice = usersWithFetes.find((u) => u.email === 'alice@charity.org')
  assert.ok(alice && alice.fetes.length > 0)

  sqlite.close()
})


