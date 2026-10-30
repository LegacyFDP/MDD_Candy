import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'people-test-'))
const dbFile = path.join(dir, 'test.db')
fs.writeFileSync(dbFile, '')
process.env.DB_PATH = dbFile

const { db, ensureRuntimeSchema, ensurePeopleSchema, createRetoolDb } = await import('../server/src/db.ts')
globalThis.retoolDb = createRetoolDb(db)
await ensureRuntimeSchema()

const { default: getPeople } = await import('../backend/fete/getPeople.ts')
const { default: savePerson } = await import('../backend/fete/savePerson.ts')
const { default: deletePerson } = await import('../backend/fete/deletePerson.ts')
const { default: mergePeople } = await import('../backend/fete/mergePeople.ts')

const q = (sql, params = []) => retoolDb.query(sql, params).then(r => r.data)
const people = async () => (await getPeople({ params: {}, user: null }))
const byName = async name => (await people()).find(p => p.name === name)

test.after(() => {
  db.close()
  fs.rmSync(dir, { recursive: true, force: true })
})

test('migration links legacy records and merges matching name + email', async () => {
  await q(`INSERT INTO fete_users (name, email, role, pin) VALUES ('Tim', 'tim@example.com', 'admin', '1111')`)
  await q(`INSERT INTO fete_volunteers (name, email, phone, role) VALUES ('tim ', 'TIM@example.com', '0123', 'Helper')`)
  await q(`INSERT INTO volunteer_roles (volunteer_id, role) SELECT id, 'Helper' FROM fete_volunteers WHERE name = 'tim '`)
  await q(`INSERT INTO fete_volunteers (name, email, phone, role) VALUES ('Tim', 'other@example.com', '', 'Helper')`)
  await q(`INSERT INTO fete_contacts (name, email) VALUES ('Pat', '')`)
  await q(`INSERT INTO fete_contacts (name, email) VALUES ('Pat', '')`)
  await ensurePeopleSchema(db)
  await ensurePeopleSchema(db)

  const all = await people()
  const tims = all.filter(p => p.name.trim().toLowerCase() === 'tim')
  assert.equal(tims.length, 2)
  const merged = tims.find(p => p.email === 'tim@example.com')
  assert.deepEqual([...merged.roles].sort(), ['Admin', 'Volunteer'])
  assert.equal(merged.phone, '0123')
  assert.equal(all.filter(p => p.name === 'Pat').length, 2)
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
  await q(`INSERT INTO volunteer_shifts (volunteer_id, fete_id, role, start_date, end_date, start_time, end_time) VALUES ($1, $2, 'Helper', '2026-07-01', '2026-07-01', '09:00', '12:00')`, [otherTim.volunteer_id, fete.id])

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
  const alice = await byName('Alice Adams')
  const bob = await byName('Bob Brown')
  await assert.rejects(mergePeople({ params: { keep_id: alice.id, merge_id: bob.id }, user: null }), /login accounts/)
})
