import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'superuser-test-'))
const dbFile = path.join(dir, 'test.db')
fs.writeFileSync(dbFile, '')
process.env.DB_PATH = dbFile

const { db, ensureRuntimeSchema, createRetoolDb } = await import('../server/src/db.ts')
globalThis.retoolDb = createRetoolDb(db)
await ensureRuntimeSchema()

const q = (sql, params = []) => retoolDb.query(sql, params).then(r => r.data)
const call = async (name, params, user = null) =>
  (await import(`../backend/fete/${name}.ts`)).default({ params, user })
const sessions = await import('../backend/fete/sessions.ts')

async function addPerson(name, email, roles) {
  const { id } = await call('savePerson', { name, email, pin: '1234', roles })
  const [account] = await q('SELECT id FROM fete_users WHERE person_id = $1', [id])
  return { personId: id, userId: account.id }
}

const boss = await addPerson('Boss', 'boss@example.com', ['Admin'])
const admin = await addPerson('Ann Admin', 'ann@example.com', ['Admin'])
await q("INSERT INTO person_roles (person_id, role) VALUES ($1, 'Superuser')", [boss.personId])

const signIn = async email => {
  const { token } = await call('loginUser', { email, pin: '1234' })
  return { token, user: await sessions.getSessionUser(token) }
}

test('signing in issues a token that identifies the user and their role until signed out', async () => {
  const { token, user } = await signIn('boss@example.com')
  assert.equal(user.id, boss.userId)
  assert.equal(user.role, 'superuser')
  assert.equal((await signIn('ann@example.com')).user.role, 'admin')

  const [stored] = await q('SELECT token_hash FROM user_sessions WHERE user_id = $1', [boss.userId])
  assert.notEqual(stored.token_hash, token, 'only a hash of the token is stored')

  await sessions.deleteSession(token)
  assert.equal(await sessions.getSessionUser(token), null)
  assert.equal(await sessions.getSessionUser('not-a-token'), null)
})

test('expired sessions are refused', async () => {
  const { token } = await signIn('ann@example.com')
  await q("UPDATE user_sessions SET expires_at = datetime('now', '-1 minute')")
  assert.equal(await sessions.getSessionUser(token), null)
})

test('archived stores and events are only listed for the Superuser; only they restore', async () => {
  const superuser = (await signIn('boss@example.com')).user
  const adminUser = (await signIn('ann@example.com')).user

  await call('saveLocation', { name: 'Old Shed' })
  const [shed] = await q("SELECT id FROM store_locations WHERE name = 'Old Shed'")
  await call('archiveLocation', { id: shed.id }, adminUser)
  const [archived] = await q('SELECT archived_by FROM store_locations WHERE id = $1', [shed.id])
  assert.equal(archived.archived_by, adminUser.id, 'records the signed-in user')

  const names = async user => (await call('getLocations', {}, user)).map(l => l.name)
  assert.ok(!(await names(adminUser)).includes('Old Shed'))
  assert.ok((await names(superuser)).includes('Old Shed'))

  await assert.rejects(call('archiveLocation', { id: shed.id, restore: true }, adminUser), /Only the Superuser/)
  await call('archiveLocation', { id: shed.id, restore: true }, superuser)
  assert.ok((await names(adminUser)).includes('Old Shed'))

  await call('saveFete', { name: 'Old Gala', event_date: '2025-06-01', description: '', status: 'completed' }, adminUser)
  const [gala] = await q("SELECT id, created_by FROM fetes WHERE name = 'Old Gala'")
  assert.equal(gala.created_by, adminUser.id)
  await call('archiveFete', { id: gala.id }, adminUser)
  assert.ok(!(await call('getFetes', {}, adminUser)).some(f => f.id === gala.id))
  assert.ok((await call('getFetes', {}, superuser)).some(f => f.id === gala.id))
  await assert.rejects(call('archiveFete', { id: gala.id, restore: true }, adminUser), /Only the Superuser/)
})

test('only Admins edit events, though anyone may add one', async () => {
  const plain = await addPerson('Pat User', 'pat@example.com', ['User'])
  const patUser = (await signIn('pat@example.com')).user
  assert.equal(patUser.id, plain.userId)
  await call('saveFete', { name: 'Pat Fair', event_date: '2027-06-01', description: '', status: 'planned' }, patUser)
  const [fair] = await q("SELECT id FROM fetes WHERE name = 'Pat Fair'")
  await assert.rejects(
    call('saveFete', { id: fair.id, name: 'Renamed', event_date: '2027-06-01', description: '', status: 'planned' }, patUser),
    /Only an Admin/,
  )
})

test('Admins cannot see, change, delete or merge the Superuser; the role survives edits', async () => {
  const superuser = (await signIn('boss@example.com')).user
  const adminUser = (await signIn('ann@example.com')).user

  const bossRow = async user => (await call('getPeople', {}, user)).find(p => p.id === boss.personId)
  assert.equal((await bossRow(adminUser)).pin, '', 'PIN hidden from Admins')
  assert.equal((await bossRow(superuser)).pin, '1234')

  const edit = { id: boss.personId, name: 'Boss', email: 'boss@example.com', pin: '1234', roles: ['Admin'] }
  await assert.rejects(call('savePerson', edit, adminUser), /Only the Superuser/)
  await assert.rejects(call('deletePerson', { id: boss.personId }, adminUser), /Only the Superuser/)
  await assert.rejects(call('mergePeople', { keep_id: admin.personId, merge_id: boss.personId }, adminUser), /Only the Superuser/)

  // Saving without the role in the list (as the People page does) keeps it,
  // and sending it cannot grant it to anyone else.
  await call('savePerson', { ...edit, name: 'The Boss' }, superuser)
  assert.equal((await signIn('boss@example.com')).user.role, 'superuser')
  await call('savePerson', { id: admin.personId, name: 'Ann Admin', email: 'ann@example.com', pin: '1234', roles: ['Admin', 'Superuser'] }, adminUser)
  assert.equal((await signIn('ann@example.com')).user.role, 'admin')
})

test('the Superuser counts as a Store Keeper for stock movements', async () => {
  const { meetsRole } = await import('../backend/fete/personRecords.ts')
  assert.ok(meetsRole('superuser', 'store keeper'))
  assert.ok(meetsRole('superuser', 'admin'))
  assert.ok(!meetsRole('admin', 'superuser'))
  assert.ok(!meetsRole('user', 'store keeper'))
  assert.ok(!meetsRole(undefined, 'user'))
})

test('only the Superuser can delete a person together with their withdrawal history', async () => {
  const superuser = (await signIn('boss@example.com')).user
  const adminUser = (await signIn('ann@example.com')).user
  const demo = await addPerson('Demo Dan', 'dan@example.com', ['Store Keeper'])
  const other = await addPerson('Other Olly', 'olly@example.com', ['Store Keeper'])

  await call('saveAssetCategory', { name: 'Tables' })
  await call('saveAsset', { name: 'Trestle', category: 'Tables', quantity_total: 10, location_id: null, storage_area_id: null, notes: '' })
  const [asset] = await q("SELECT id FROM assets WHERE name = 'Trestle'")
  const available = async () => (await q('SELECT quantity_available AS n FROM assets WHERE id = $1', [asset.id]))[0].n
  const withdraw = (by, quantity) => call('withdrawAsset', { asset_id: asset.id, fete_id: null, quantity, withdrawn_by: by, notes: '' })

  await withdraw(demo.userId, 3)          // still out
  await withdraw(demo.userId, 2)          // returned below
  await withdraw(other.userId, 1)         // Olly's, returned by Dan
  const [returnedOwn, returnedOther] = await q(
    'SELECT id FROM withdrawals WHERE asset_id = $1 AND quantity IN (2, 1) ORDER BY quantity DESC', [asset.id])
  await call('returnAsset', { withdrawal_id: returnedOwn.id, returned_by: demo.userId, notes: '' })
  await call('returnAsset', { withdrawal_id: returnedOther.id, returned_by: demo.userId, notes: '' })
  assert.equal(await available(), 7)      // 3 still out with Dan

  await assert.rejects(call('deletePerson', { id: demo.personId }, superuser), /3 withdrawal records/)
  await assert.rejects(call('deletePerson', { id: demo.personId, delete_withdrawals: true }, adminUser), /Only the Superuser/)

  await call('deletePerson', { id: demo.personId, delete_withdrawals: true }, superuser)
  assert.equal(await available(), 10, 'items Dan still had out go back into stock')
  assert.deepEqual(await q('SELECT id FROM fete_users WHERE id = $1', [demo.userId]), [])
  const left = await q('SELECT withdrawn_by, returned_by, status FROM withdrawals WHERE asset_id = $1', [asset.id])
  assert.deepEqual(left, [{ withdrawn_by: other.userId, returned_by: null, status: 'returned' }],
    "Olly's withdrawal stays, without Dan's name as returner")
})
