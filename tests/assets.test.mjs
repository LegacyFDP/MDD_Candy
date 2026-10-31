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
