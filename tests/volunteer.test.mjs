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
