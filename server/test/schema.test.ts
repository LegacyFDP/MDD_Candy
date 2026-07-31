import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import sqlite3 from 'sqlite3'

test('ensureRuntimeSchema creates the core tables for a fresh SQLite database', async () => {
  const previousEnv = { ...process.env }
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mdd-candy-'))
  const dbPath = path.join(tempDir, 'schema-test.sqlite')

  process.env.DB_PATH = dbPath
  process.env.DB_BACKUP_DIR = path.join(tempDir, 'backups')

  try {
    const { ensureRuntimeSchema } = await import('../src/db.ts')
    const database = new sqlite3.Database(dbPath)

    await new Promise<void>((resolve, reject) => {
      database.once('open', () => resolve())
      database.once('error', reject)
    })

    await ensureRuntimeSchema(database)

    const tables = await new Promise<string[]>((resolve, reject) => {
      database.all(
        "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('fete_users','store_locations','assets','fetes','withdrawals','fete_volunteers','fete_requirements','volunteers','volunteer_roles','fete_volunteer_assignments','fete_volunteer_availability','db_backups') ORDER BY name",
        (err, rows: Array<{ name: string }>) => {
          if (err) reject(err)
          else resolve(rows.map((row) => row.name))
        },
      )
    })

    assert.deepEqual(tables, [
      'assets',
      'db_backups',
      'fete_requirements',
      'fete_users',
      'fete_volunteer_assignments',
      'fete_volunteer_availability',
      'fete_volunteers',
      'fetes',
      'store_locations',
      'volunteer_roles',
      'volunteers',
      'withdrawals',
    ])

    await new Promise<void>((resolve, reject) => database.close((err) => (err ? reject(err) : resolve())))
  } finally {
    process.env = previousEnv
    try {
      fs.rmSync(tempDir, { recursive: true, force: true })
    } catch {
      // On Windows, sqlite handles can keep the temp directory locked briefly.
      // The test still passes; cleanup is best-effort.
    }
  }
})
