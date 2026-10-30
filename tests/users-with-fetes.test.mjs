import test from 'node:test'
import assert from 'node:assert/strict'

test('getUsersWithFetes returns each user with events they created', async () => {
  const rows = [
    {
      id: 1, name: 'Alex', email: 'alex@example.com', role: 'admin', pin: '1234',
      fete_id: 7, fete_name: 'Summer Fair', event_date: '2026-07-18',
      fete_status: 'completed', notes: 'Main event',
    },
    {
      id: 1, name: 'Alex', email: 'alex@example.com', role: 'admin', pin: '1234',
      fete_id: 8, fete_name: 'Winter Fair', event_date: null,
      fete_status: 'planned', notes: null,
    },
    {
      id: 2, name: 'Sam', email: 'sam@example.com', role: 'user', pin: '5678',
      fete_id: null, fete_name: null, event_date: null, fete_status: null, notes: null,
    },
  ]
  let executedSql = ''
  globalThis.retoolDb = {
    async query(sql) {
      executedSql = sql
      return { data: rows }
    },
  }

  const { default: getUsersWithFetes } = await import('../backend/fete/getUsersWithFetes.ts')
  const users = await getUsersWithFetes({ params: {}, user: null })

  assert.match(executedSql, /LEFT JOIN fetes f ON f\.created_by = u\.id/)
  assert.equal(users.length, 2)
  assert.deepEqual(users[0].fetes, [
    {
      fete_id: 7,
      fete_name: 'Summer Fair',
      event_date: '2026-07-18',
      fete_status: 'completed',
      notes: 'Main event',
    },
    {
      fete_id: 8,
      fete_name: 'Winter Fair',
      event_date: null,
      fete_status: 'planned',
      notes: '',
    },
  ])
  assert.deepEqual(users[1].fetes, [])
})
