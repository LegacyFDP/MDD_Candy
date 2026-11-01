import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'assets-test-'))
const dbFile = path.join(dir, 'test.db')
fs.writeFileSync(dbFile, '')
process.env.DB_PATH = dbFile

const { db, ensureRuntimeSchema, createRetoolDb } = await import('../server/src/db.ts')
globalThis.retoolDb = createRetoolDb(db)
await ensureRuntimeSchema()

const { default: getAssets } = await import('../backend/fete/getAssets.ts')
const { default: saveAsset } = await import('../backend/fete/saveAsset.ts')
const { default: saveAssetCategory } = await import('../backend/fete/saveAssetCategory.ts')
const { default: deleteAssetCategory } = await import('../backend/fete/deleteAssetCategory.ts')

const q = (sql, params = []) => retoolDb.query(sql, params).then(r => r.data)
const assets = async () => getAssets({ params: {}, user: null })
const byName = async name => (await assets()).find(a => a.name === name)
const categoryId = async name => (await q('SELECT id FROM asset_categories WHERE name = $1', [name]))[0]?.id

test.after(() => {
  db.close()
  fs.rmSync(dir, { recursive: true, force: true })
})

test('fresh schema stores category_id and seeds assets with their category names', async () => {
  const columns = (await q('PRAGMA table_info(assets)')).map(c => c.name)
  assert.ok(columns.includes('category_id'))
  assert.ok(!columns.includes('category'))
  assert.equal((await byName('Gazebo 3x3m')).category, 'Shelter')
  assert.equal((await assets()).length, 12)
})

test('saving an asset with a new category name registers the category', async () => {
  await saveAsset({ params: { name: 'Bouncy Castle', category: 'Inflatables', quantity_total: 1, location_id: 1, storage_area_id: null, notes: '' }, user: null })
  const id = await categoryId('Inflatables')
  assert.ok(id)
  const [row] = await q('SELECT category_id FROM assets WHERE name = $1', ['Bouncy Castle'])
  assert.equal(row.category_id, id)
  assert.equal((await byName('Bouncy Castle')).category, 'Inflatables')
})

test('renaming a category is reflected on its assets', async () => {
  await saveAssetCategory({ params: { id: await categoryId('Inflatables'), name: 'Bouncy Things' }, user: null })
  assert.equal((await byName('Bouncy Castle')).category, 'Bouncy Things')
})

test('changing asset status needs an Admin or Store Keeper role on the person', async () => {
  const { default: withdrawAsset } = await import('../backend/fete/withdrawAsset.ts')
  const userId = async email => (await q('SELECT id, person_id FROM fete_users WHERE email = $1', [email]))[0]
  const alice = await userId('alice@charity.org')
  const carol = await userId('carol@charity.org')
  const [{ id: assetId }] = await q(`SELECT id FROM assets WHERE name = 'Folding Chair'`)
  const withdraw = by => withdrawAsset({ params: { asset_id: assetId, fete_id: null, quantity: 1, withdrawn_by: by, notes: '' }, user: null })

  await assert.rejects(withdraw(carol.id), /Only admin or store keeper/)
  await withdraw(alice.id)
  await q(`INSERT INTO person_roles (person_id, role) VALUES ($1, 'Store Keeper')`, [carol.person_id])
  await withdraw(carol.id)
  await assert.rejects(withdraw(9999), /user not found/)
})

test('startup removes rows pointing at deleted assets and fetes', async () => {
  const [{ id: assetId }] = await q(`SELECT id FROM assets ORDER BY id LIMIT 1`)
  const [{ id: feteId }] = await q(`SELECT id FROM fetes ORDER BY id LIMIT 1`)
  const [{ id: userId }] = await q(`SELECT id FROM fete_users ORDER BY id LIMIT 1`)
  await q(`INSERT INTO withdrawals (asset_id, fete_id, quantity, withdrawn_by, notes) VALUES (9999, $1, 1, $2, 'orphan asset')`, [feteId, userId])
  await q(`INSERT INTO withdrawals (asset_id, fete_id, quantity, withdrawn_by, notes) VALUES ($1, 9999, 1, $2, 'orphan fete')`, [assetId, userId])
  await q(`INSERT INTO fete_requirements (fete_id, asset_id, quantity_needed, notes) VALUES ($1, 9999, 1, 'orphan asset')`, [feteId])
  await q(`INSERT INTO fete_requirements (fete_id, asset_id, quantity_needed, notes) VALUES (9999, $1, 1, 'orphan fete')`, [assetId])

  await ensureRuntimeSchema()

  assert.equal((await q(`SELECT COUNT(*) AS n FROM withdrawals WHERE notes = 'orphan asset'`))[0].n, 0)
  assert.deepEqual(await q(`SELECT fete_id FROM withdrawals WHERE notes = 'orphan fete'`), [{ fete_id: null }])
  assert.equal((await q(`SELECT COUNT(*) AS n FROM fete_requirements WHERE notes LIKE 'orphan%'`))[0].n, 0)
  assert.equal((await q(`SELECT COUNT(*) AS n FROM fete_requirements`))[0].n, 4)
})

test('a category in use cannot be deleted; an unused one can', async () => {
  await assert.rejects(
    deleteAssetCategory({ params: { id: await categoryId('Bouncy Things') }, user: null }),
    /Move or delete the assets/,
  )
  await saveAssetCategory({ params: { name: 'Unused' }, user: null })
  await deleteAssetCategory({ params: { id: await categoryId('Unused') }, user: null })
  assert.equal(await categoryId('Unused'), undefined)
})

test('deleting a category in use can move its assets into another category first', async () => {
  const { default: getAssetCategories } = await import('../backend/fete/getAssetCategories.ts')
  const count = async name => (await getAssetCategories({ params: {}, user: null })).find(c => c.name === name)?.asset_count
  const shelterBefore = await count('Shelter')
  assert.equal(await count('Bouncy Things'), 1)

  const fromId = await categoryId('Bouncy Things')
  await assert.rejects(
    deleteAssetCategory({ params: { id: fromId, move_to_id: fromId }, user: null }),
    /different category/,
  )
  await deleteAssetCategory({ params: { id: fromId, move_to_id: await categoryId('Shelter') }, user: null })

  assert.equal(await categoryId('Bouncy Things'), undefined)
  assert.equal(await count('Shelter'), shelterBefore + 1)
  assert.equal((await byName('Bouncy Castle')).category, 'Shelter')
})
