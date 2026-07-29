import { accessSync, constants, existsSync } from 'node:fs'
import { requireAdmin } from './_auth'
import { getBackupDirPath, getDbPath, listBackupFiles } from './_backupFs'

type CountRow = { count: number }

type QuickCheckRow = { quick_check?: string }

async function getCount(sql: string, params: unknown[] = []): Promise<number> {
  const result = await retoolDb.query<CountRow>(sql, params)
  return Number(result.data[0]?.count ?? 0)
}

export default async function (req: { params: Record<string, never>; user: User }) {
  requireAdmin(req.user)

  const dbPath = getDbPath()
  const backupDir = getBackupDirPath()

  const dbPathExists = existsSync(dbPath)
  const backupDirExists = existsSync(backupDir)

  let backupDirWritable = false
  if (backupDirExists) {
    try {
      accessSync(backupDir, constants.W_OK)
      backupDirWritable = true
    } catch {
      backupDirWritable = false
    }
  }

  const quickCheck = await retoolDb.query<QuickCheckRow>('PRAGMA quick_check')
  const databaseCheck = (quickCheck.data[0]?.quick_check ?? '').toLowerCase()
  const integrityOk = databaseCheck === 'ok'

  const legacyAssignments = await getCount('SELECT COUNT(*) AS count FROM fete_volunteers')
  const normalizedAssignments = await getCount('SELECT COUNT(*) AS count FROM fete_volunteer_assignments')
  const migratedFromLegacy = await getCount(
    'SELECT COUNT(*) AS count FROM fete_volunteer_assignments WHERE legacy_fete_volunteer_id IS NOT NULL',
  )
  const legacyWithoutNormalizedMatch = await getCount(
    `
      SELECT COUNT(*) AS count
      FROM fete_volunteers fv
      LEFT JOIN fete_volunteer_assignments a ON a.legacy_fete_volunteer_id = fv.id
      WHERE a.id IS NULL
    `,
  )

  const availabilitySlots = await getCount('SELECT COUNT(*) AS count FROM fete_volunteer_availability')
  const scheduledAssignmentCount = await getCount(
    'SELECT COUNT(DISTINCT assignment_id) AS count FROM fete_volunteer_availability',
  )
  const trackedBackups = await getCount('SELECT COUNT(*) AS count FROM db_backups WHERE deleted_at IS NULL')
  const backupFilesOnDisk = listBackupFiles().length

  return {
    checked_at: new Date().toISOString(),
    environment: {
      db_path: dbPath,
      db_path_exists: dbPathExists,
      backup_dir: backupDir,
      backup_dir_exists: backupDirExists,
      backup_dir_writable: backupDirWritable,
    },
    database_health: {
      quick_check: databaseCheck || 'unknown',
      integrity_ok: integrityOk,
    },
    migration: {
      legacy_assignments: legacyAssignments,
      normalized_assignments: normalizedAssignments,
      migrated_from_legacy: migratedFromLegacy,
      legacy_without_normalized_match: legacyWithoutNormalizedMatch,
    },
    scheduling: {
      availability_slots: availabilitySlots,
      assignments_with_schedule: scheduledAssignmentCount,
    },
    backups: {
      tracked_backups: trackedBackups,
      backup_files_on_disk: backupFilesOnDisk,
    },
  }
}
