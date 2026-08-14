import path from 'node:path'
import { fileURLToPath } from 'node:url'

export interface RuntimePaths {
  dbPath: string
  backupDir: string
}

function readEnv(name: string): string | undefined {
  const value = process.env[name]?.trim()
  return value ? value : undefined
}

export function resolveRuntimePaths(): RuntimePaths {
  const serverDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
  const defaultDbPath = path.resolve(serverDir, 'fete_store.db')
  const defaultBackupDir = path.resolve(serverDir, 'backups')

  return {
    dbPath: path.resolve(readEnv('DB_PATH') ?? defaultDbPath),
    backupDir: path.resolve(readEnv('DB_BACKUP_DIR') ?? defaultBackupDir),
  }
}