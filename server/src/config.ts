import path from 'node:path'
import { fileURLToPath } from 'node:url'

export interface RuntimePaths {
  dbPath: string
  backupDir: string
}

export function resolveRuntimePaths(): RuntimePaths {
  const currentDir = path.dirname(fileURLToPath(import.meta.url))
  const repoRoot = path.resolve(currentDir, '..', '..')
  const fallbackDbPath = path.join(repoRoot, 'MDD_Candy.db')
  const fallbackBackupDir = path.join(repoRoot, 'backups')

  const dbPath = process.env.DB_PATH?.trim() || fallbackDbPath
  const backupDir = process.env.DB_BACKUP_DIR?.trim() || fallbackBackupDir

  return {
    dbPath: path.resolve(dbPath),
    backupDir: path.resolve(backupDir),
  }
}
