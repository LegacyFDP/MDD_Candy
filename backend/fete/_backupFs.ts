import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs'
import path from 'node:path'

function requireEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(`${name} is required`)
  }
  return value
}

function nowStamp(): string {
  const d = new Date()
  const yyyy = d.getFullYear().toString()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  const ss = String(d.getSeconds()).padStart(2, '0')
  return `${yyyy}${mm}${dd}-${hh}${mi}${ss}`
}

export function getDbPath(): string {
  return path.resolve(requireEnv('DB_PATH'))
}

export function getBackupDirPath(): string {
  return path.resolve(requireEnv('DB_BACKUP_DIR'))
}

export function ensureBackupDir(): string {
  const backupDir = getBackupDirPath()
  if (!existsSync(backupDir)) {
    mkdirSync(backupDir, { recursive: true })
  }
  return backupDir
}

export function createBackupFile(prefix = 'MDD_Candy-manual'): {
  filename: string
  absolutePath: string
  byteSize: number
  createdAt: string
} {
  const backupDir = ensureBackupDir()
  const dbPath = getDbPath()
  const filename = `${prefix}-${nowStamp()}.db`
  const absolutePath = path.join(backupDir, filename)
  copyFileSync(dbPath, absolutePath)
  const stats = statSync(absolutePath)
  return {
    filename,
    absolutePath,
    byteSize: stats.size,
    createdAt: new Date().toISOString(),
  }
}

function isSafeFilename(name: string): boolean {
  return /^[A-Za-z0-9._-]+$/.test(name)
}

export function deleteBackupFile(filename: string): string {
  const trimmed = filename.trim()
  if (!trimmed || !isSafeFilename(trimmed)) {
    throw new Error('Invalid backup filename')
  }

  const backupDir = ensureBackupDir()
  const absolutePath = path.resolve(path.join(backupDir, trimmed))
  const backupRoot = `${backupDir}${path.sep}`

  if (!absolutePath.startsWith(backupRoot)) {
    throw new Error('Invalid backup path')
  }

  if (!existsSync(absolutePath)) {
    throw new Error('Backup file not found')
  }

  rmSync(absolutePath)
  return absolutePath
}

export function listBackupFiles(): Array<{ filename: string; absolutePath: string; byteSize: number; mtime: string }> {
  const backupDir = ensureBackupDir()
  const files = readdirSync(backupDir)
    .filter((file) => file.toLowerCase().endsWith('.db'))
    .map((filename) => {
      const absolutePath = path.join(backupDir, filename)
      const stats = statSync(absolutePath)
      return {
        filename,
        absolutePath,
        byteSize: stats.size,
        mtime: stats.mtime.toISOString(),
      }
    })
    .sort((a, b) => (a.mtime < b.mtime ? 1 : -1))

  return files
}
