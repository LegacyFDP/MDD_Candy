import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveRuntimePaths } from '../src/config.ts'

test('resolveRuntimePaths falls back to bundled local defaults when env vars are missing', () => {
  const previousEnv = { ...process.env }

  delete process.env.DB_PATH
  delete process.env.DB_BACKUP_DIR

  try {
    const paths = resolveRuntimePaths()
    assert.match(paths.dbPath, /fete_store\.db$/)
    assert.match(paths.backupDir, /backups$/)
    assert.ok(!paths.dbPath.includes('D:\\D:\\'))
    assert.ok(!paths.backupDir.includes('D:\\D:\\'))
  } finally {
    process.env = previousEnv
  }
})
