import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rota-test-'))
const dbFile = path.join(dir, 'test.db')
fs.writeFileSync(dbFile, '')
process.env.DB_PATH = dbFile

const { db, ensureRuntimeSchema, createRetoolDb } = await import('../server/src/db.ts')
globalThis.retoolDb = createRetoolDb(db)
await ensureRuntimeSchema()

const q = (sql, params = []) => retoolDb.query(sql, params).then(r => r.data)
const call = async (name, params) => (await import(`../backend/fete/${name}.ts`)).default({ params, user: null })

const { id: volunteerId } = await call('savePerson', { name: 'Val Volunteer', roles: ['Volunteer'], volunteer_roles: ['Helper'] })
const shiftRoleCount = async shiftId => (await q('SELECT COUNT(*) AS n FROM volunteer_shift_roles WHERE shift_id = $1', [shiftId]))[0].n

test('shifts with or without an event can be added, edited and deleted', async () => {
  await call('saveVolunteerShift', {
    volunteer_id: volunteerId, fete_id: null, roles: ['Helper', 'Transport'],
    shifts: [{ start_date: '2027-06-01', end_date: '2027-06-01', start_time: '09:30', end_time: '11:00' }],
  })
  const [shift] = await q('SELECT id FROM volunteer_shifts WHERE person_id = $1', [volunteerId])
  assert.equal(await shiftRoleCount(shift.id), 2)

  await call('saveVolunteerShift', {
    id: shift.id, volunteer_id: volunteerId, fete_id: null, roles: ['Helper'],
    start_date: '2027-06-01', end_date: '2027-06-01', start_time: '13:00', end_time: '14:30',
  })
  const [edited] = await q('SELECT start_time, end_time FROM volunteer_shifts WHERE id = $1', [shift.id])
  assert.deepEqual(edited, { start_time: '13:00', end_time: '14:30' })
  assert.equal(await shiftRoleCount(shift.id), 1)

  await call('deleteVolunteerShift', { id: shift.id })
  assert.deepEqual(await q('SELECT id FROM volunteer_shifts WHERE id = $1', [shift.id]), [])
  assert.equal(await shiftRoleCount(shift.id), 0, 'deleting a shift removes its roles too')
})

test('startup removes shift roles left behind by older deletes', async () => {
  await q("INSERT INTO volunteer_shift_roles (shift_id, role) VALUES (999999, 'Helper')")
  await ensureRuntimeSchema()
  assert.equal(await shiftRoleCount(999999), 0)
})
