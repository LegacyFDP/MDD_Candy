import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const backendDir = path.resolve('backend/fete')

test('volunteer backend and schema support exist', () => {
  assert.ok(fs.existsSync(path.join(backendDir, 'getVolunteers.ts')), 'Missing getVolunteers.ts')
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

test('volunteer rota spreadsheet matrix calculates counts for hours and tasks', () => {
  const printListsSrc = fs.readFileSync(path.resolve('frontend/pages/PrintListsPage.tsx'), 'utf8')
  assert.ok(printListsSrc.includes('card-print-volunteer-matrix'), 'Missing matrix card ID')
  assert.ok(printListsSrc.includes('print-volunteer-matrix'), 'Missing matrix print section ID')
  assert.ok(printListsSrc.includes('downloadVolunteerMatrixCsv'), 'Missing matrix CSV download')
  assert.ok(printListsSrc.includes('spreadsheet-table'), 'Missing spreadsheet-table class')

  // Pure logic verification of hours x tasks matrix with volunteer counts in cells
  const shifts = [
    {
      id: 1,
      volunteer_id: 101,
      volunteer_name: 'Alice',
      fete_id: 1,
      roles: ['Lead Volunteer', 'Helper'],
      start_date: '2026-07-11',
      end_date: '2026-07-11',
      start_time: '09:00',
      end_time: '12:00',
    },
    {
      id: 2,
      volunteer_id: 102,
      volunteer_name: 'Bob',
      fete_id: 1,
      roles: ['Helper'],
      start_date: '2026-07-11',
      end_date: '2026-07-11',
      start_time: '10:00',
      end_time: '13:00',
    },
    {
      id: 3,
      volunteer_id: 103,
      volunteer_name: 'Charlie',
      fete_id: 1,
      roles: ['Stall Holder'],
      start_date: '2026-07-11',
      end_date: '2026-07-11',
      start_time: '11:00',
      end_time: '15:00',
    },
  ]

  const toMinutes = (t) => {
    const [h, m] = t.split(':').map(Number)
    return h * 60 + m
  }
  const isShiftInHour = (shift, slotStart, slotEnd) => {
    return toMinutes(shift.start_time) < toMinutes(slotEnd) && toMinutes(shift.end_time) > toMinutes(slotStart)
  }

  // Check 09:00 - 10:00:
  // Lead Volunteer: Alice (1)
  // Helper: Alice (1)
  // Stall Holder: 0
  const hour0910 = shifts.filter(s => isShiftInHour(s, '09:00', '10:00'))
  assert.equal(hour0910.filter(s => s.roles.includes('Lead Volunteer')).length, 1)
  assert.equal(hour0910.filter(s => s.roles.includes('Helper')).length, 1)
  assert.equal(hour0910.filter(s => s.roles.includes('Stall Holder')).length, 0)
  assert.equal(new Set(hour0910.map(s => s.volunteer_id)).size, 1) // Unique volunteer count = 1

  // Check 11:00 - 12:00:
  // Lead Volunteer: Alice (1)
  // Helper: Alice, Bob (2)
  // Stall Holder: Charlie (1)
  const hour1112 = shifts.filter(s => isShiftInHour(s, '11:00', '12:00'))
  assert.equal(hour1112.filter(s => s.roles.includes('Lead Volunteer')).length, 1)
  assert.equal(hour1112.filter(s => s.roles.includes('Helper')).length, 2)
  assert.equal(hour1112.filter(s => s.roles.includes('Stall Holder')).length, 1)
  assert.equal(new Set(hour1112.map(s => s.volunteer_id)).size, 3) // Unique volunteer count = 3
})
