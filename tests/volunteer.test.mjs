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

test('saveVolunteerShift allocates volunteer across multiple days (all days)', async () => {
  const queries = []
  globalThis.retoolDb = {
    async query(sql, params) {
      queries.push({ sql, params })
      if (sql.includes('RETURNING id')) {
        return { data: [{ id: 100 + queries.length }] }
      }
      return { data: [] }
    },
  }

  const { default: saveVolunteerShift } = await import('../backend/fete/saveVolunteerShift.ts')

  const res = await saveVolunteerShift({
    params: {
      volunteer_id: 1,
      roles: ['Helper'],
      shifts: [
        { start_date: '2026-07-10', end_date: '2026-07-10', start_time: '09:00', end_time: '12:00' },
        { start_date: '2026-07-11', end_date: '2026-07-11', start_time: '09:00', end_time: '12:00' },
        { start_date: '2026-07-12', end_date: '2026-07-12', start_time: '09:00', end_time: '12:00' },
      ],
    },
    user: null,
  })

  assert.equal(res.success, true)
  assert.equal(res.count, 3)
  const insertQueries = queries.filter(q => q.sql.includes('INSERT INTO volunteer_shifts'))
  assert.equal(insertQueries.length, 3)
})

test('saveVolunteerShift allocates volunteer to custom time slots on individual days', async () => {
  const queries = []
  globalThis.retoolDb = {
    async query(sql, params) {
      queries.push({ sql, params })
      if (sql.includes('RETURNING id')) {
        return { data: [{ id: 200 + queries.length }] }
      }
      return { data: [] }
    },
  }

  const { default: saveVolunteerShift } = await import('../backend/fete/saveVolunteerShift.ts')

  // Volunteer allocated on 10th (morning) and 12th (afternoon), but not on 11th
  const res = await saveVolunteerShift({
    params: {
      volunteer_id: 2,
      roles: ['Stall Holder'],
      days: [
        {
          date: '2026-07-10',
          slots: [{ start_time: '09:00', end_time: '13:00' }],
        },
        {
          date: '2026-07-12',
          slots: [{ start_time: '14:00', end_time: '18:00' }],
        },
      ],
    },
    user: null,
  })

  assert.equal(res.success, true)
  assert.equal(res.count, 2)
  const insertQueries = queries.filter(q => q.sql.includes('INSERT INTO volunteer_shifts'))
  assert.equal(insertQueries.length, 2)
  assert.equal(insertQueries[0].params[3], '2026-07-10')
  assert.equal(insertQueries[0].params[5], '09:00')
  assert.equal(insertQueries[0].params[6], '13:00')
  assert.equal(insertQueries[1].params[3], '2026-07-12')
  assert.equal(insertQueries[1].params[5], '14:00')
  assert.equal(insertQueries[1].params[6], '18:00')
})

test('saveVolunteerShift requires at least one time slot', async () => {
  const { default: saveVolunteerShift } = await import('../backend/fete/saveVolunteerShift.ts')

  await assert.rejects(
    saveVolunteerShift({
      params: {
        volunteer_id: 1,
        shifts: [],
      },
      user: null,
    }),
    /At least one time slot must be allocated/
  )
})

test('saveVolunteerShift validates 1-hour increments within 09:00-18:00', async () => {
  const { default: saveVolunteerShift } = await import('../backend/fete/saveVolunteerShift.ts')

  // Outside 09:00-18:00
  await assert.rejects(
    saveVolunteerShift({
      params: {
        volunteer_id: 1,
        shifts: [
          { start_date: '2026-07-10', end_date: '2026-07-10', start_time: '08:00', end_time: '11:00' },
        ],
      },
      user: null,
    }),
    /Shift times must stay between 09:00 and 18:00/
  )

  // Not 1-hour increment
  await assert.rejects(
    saveVolunteerShift({
      params: {
        volunteer_id: 1,
        shifts: [
          { start_date: '2026-07-10', end_date: '2026-07-10', start_time: '09:00', end_time: '09:30' },
        ],
      },
      user: null,
    }),
    /Shift blocks must be 1-hour increments/
  )
})
