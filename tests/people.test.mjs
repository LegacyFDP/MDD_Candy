import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'people-test-'))
const dbFile = path.join(dir, 'test.db')
fs.writeFileSync(dbFile, '')
process.env.DB_PATH = dbFile

const { db, ensureRuntimeSchema, createRetoolDb } = await import('../server/src/db.ts')
globalThis.retoolDb = createRetoolDb(db)

// Start from the shape these tables had before people existed, so the first
// test exercises the real linking and column-dropping migration.
const q = (sql, params = []) => retoolDb.query(sql, params).then(r => r.data)
await q(`CREATE TABLE fete_users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'user', pin TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`)
await q(`CREATE TABLE fete_volunteers (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT, phone TEXT,
  role TEXT NOT NULL DEFAULT 'Helper', notes TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`)
await q(`CREATE TABLE fete_contacts (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`)
await q(`INSERT INTO fete_users (name, email, role, pin) VALUES ('Tim', 'tim@example.com', 'admin', '1111')`)
await q(`INSERT INTO fete_volunteers (name, email, phone, role) VALUES ('tim ', 'TIM@example.com', '0123', 'Helper')`)
await q(`INSERT INTO fete_volunteers (name, email, phone, role, notes) VALUES ('Tim', 'other@example.com', '', 'Helper', 'Has a van')`)
await q(`INSERT INTO fete_contacts (name, email) VALUES ('Pat', '')`)
await q(`INSERT INTO fete_contacts (name, email) VALUES ('Pat', '')`)
await ensureRuntimeSchema()

const { default: getPeople } = await import('../backend/fete/getPeople.ts')
const { default: savePerson } = await import('../backend/fete/savePerson.ts')
const { default: deletePerson } = await import('../backend/fete/deletePerson.ts')
const { default: mergePeople } = await import('../backend/fete/mergePeople.ts')

const people = async () => (await getPeople({ params: {}, user: null }))
const byName = async name => (await people()).find(p => p.name === name)

test.after(() => {
  db.close()
  fs.rmSync(dir, { recursive: true, force: true })
})

test('migration links legacy records, merges matching name + email, then drops the copied columns', async () => {
  await ensureRuntimeSchema()

  const all = await people()
  const tims = all.filter(p => p.name.trim().toLowerCase() === 'tim')
  assert.equal(tims.length, 2)
  const merged = tims.find(p => p.email === 'tim@example.com')
  assert.deepEqual([...merged.roles].sort(), ['Admin', 'Volunteer'])
  assert.deepEqual(merged.volunteer_roles, ['Helper'])
  assert.equal(merged.phone, '0123')
  assert.equal(tims.find(p => p.email === 'other@example.com').notes, 'Has a van')
  assert.equal(all.filter(p => p.name === 'Pat').length, 2)

  const columns = async table => (await q(`PRAGMA table_info(${table})`)).map(c => c.name).sort()
  assert.deepEqual(await columns('fete_users'), ['created_at', 'email', 'id', 'person_id', 'pin', 'role'])
  assert.deepEqual(await columns('fete_volunteers'), ['created_at', 'id', 'person_id'])
  assert.deepEqual(await columns('fete_contacts'), ['created_at', 'id', 'person_id'])
})

test('login and user list take the name from people', async () => {
  const { default: loginUser } = await import('../backend/fete/loginUser.ts')
  const { default: getUsers } = await import('../backend/fete/getUsers.ts')
  const tim = await byName('Tim')
  await savePerson({ params: { id: tim.id, name: 'Timothy', email: 'tim@example.com', phone: tim.phone, roles: tim.roles, pin: '1111', volunteer_roles: tim.volunteer_roles }, user: null })
  assert.equal((await loginUser({ params: { email: 'tim@example.com', pin: '1111' }, user: null })).name, 'Timothy')
  assert.ok((await getUsers({ params: {}, user: null })).some(u => u.name === 'Timothy'))
  await savePerson({ params: { id: tim.id, name: 'Tim', email: 'tim@example.com', phone: tim.phone, roles: tim.roles, pin: '1111', volunteer_roles: tim.volunteer_roles }, user: null })
})

test('a person can hold Admin and Store Keeper with one login at the highest level', async () => {
  await savePerson({ params: { name: 'Sue', email: 'sue@example.com', roles: ['Store Keeper', 'Admin', 'Volunteer'], pin: '2222', volunteer_roles: ['Helper'] }, user: null })
  const sue = await byName('Sue')
  assert.deepEqual([...sue.roles].sort(), ['Admin', 'Store Keeper', 'Volunteer'])
  assert.deepEqual(sue.volunteer_roles, ['Helper'])
  const [account] = await q('SELECT role, person_id FROM fete_users WHERE email = $1', ['sue@example.com'])
  assert.equal(account.role, 'admin')
  assert.equal(account.person_id, sue.id)
})

test('editing adds and removes roles on the same person', async () => {
  const sue = await byName('Sue')
  await savePerson({ params: { id: sue.id, name: 'Sue', email: 'sue@example.com', roles: ['Store Keeper'], pin: '2222' }, user: null })
  const updated = await byName('Sue')
  assert.equal((await people()).filter(p => p.name === 'Sue').length, 1)
  assert.deepEqual(updated.roles, ['Store Keeper'])
  assert.equal(updated.volunteer_id, null)
  assert.equal((await q('SELECT role FROM fete_users WHERE person_id = $1', [sue.id]))[0].role, 'store keeper')

  await savePerson({ params: { id: sue.id, name: 'Sue', email: 'sue@example.com', roles: ['Volunteer'], volunteer_roles: ['Helper'] }, user: null })
  assert.equal((await q('SELECT COUNT(*) AS n FROM fete_users WHERE person_id = $1', [sue.id]))[0].n, 0)
})

test('login email must stay unique and contacts need an event', async () => {
  await assert.rejects(
    savePerson({ params: { name: 'Dup', email: 'TIM@example.com', roles: ['User'], pin: '3333' }, user: null }),
    /already uses this email/,
  )
  await assert.rejects(
    savePerson({ params: { name: 'C', roles: ['Contact'] }, user: null }),
    /at least one event/,
  )
  assert.equal(await byName('Dup'), undefined)
})

test('merge moves shifts and roles and deletePerson removes everything', async () => {
  const [keepTim, otherTim] = [await byName('Tim'), (await people()).find(p => p.name === 'Tim' && p.email === 'other@example.com')]
  assert.ok(otherTim)
  await q(`INSERT INTO fetes (name, event_date, status) VALUES ('Fair', '2026-07-01', 'planned')`)
  const [fete] = await q(`SELECT id FROM fetes WHERE name = 'Fair'`)
  await q(`INSERT INTO volunteer_shifts (volunteer_id, fete_id, start_date, end_date, start_time, end_time) VALUES ($1, $2, '2026-07-01', '2026-07-01', '09:00', '12:00')`, [otherTim.volunteer_id, fete.id])

  await mergePeople({ params: { keep_id: keepTim.id, merge_id: otherTim.id }, user: null })
  const tim = await byName('Tim')
  assert.equal((await people()).filter(p => p.name === 'Tim').length, 1)
  assert.equal(tim.id, keepTim.id)
  assert.equal((await q('SELECT COUNT(*) AS n FROM volunteer_shifts WHERE volunteer_id = $1', [tim.volunteer_id]))[0].n, 1)

  await deletePerson({ params: { id: tim.id }, user: null })
  assert.equal((await q('SELECT COUNT(*) AS n FROM people WHERE id = $1', [tim.id]))[0].n, 0)
  assert.equal((await q('SELECT COUNT(*) AS n FROM fete_users WHERE email = $1', ['tim@example.com']))[0].n, 0)
  assert.equal((await q('SELECT COUNT(*) AS n FROM volunteer_shifts'))[0].n, 0)
})

test('two people with login accounts cannot be merged', async () => {
  await savePerson({ params: { name: 'Alice Adams', email: 'alice@example.com', roles: ['Admin'], pin: '4444' }, user: null })
  await savePerson({ params: { name: 'Bob Brown', email: 'bob@example.com', roles: ['User'], pin: '5555' }, user: null })
  const alice = await byName('Alice Adams')
  const bob = await byName('Bob Brown')
  await assert.rejects(mergePeople({ params: { keep_id: alice.id, merge_id: bob.id }, user: null }), /login accounts/)
})
