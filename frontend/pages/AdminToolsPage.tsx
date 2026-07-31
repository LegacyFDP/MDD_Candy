import { useEffect, useState } from 'react'
import {
  useGetMigrationStatus,
  useMigrateLegacyVolunteerNotes,
  useListBackups,
  useCreateBackup,
  useDeleteBackup,
} from '../hooks/backend/fete'
import { Button } from '../lib/shadcn/button'
import { Badge } from '../lib/shadcn/badge'
import { Shield } from 'lucide-react'
import type { AppUser } from './Login'

interface Props { currentUser: AppUser }

type DbBackup = {
  filename: string
  absolute_path: string
  byte_size: number
  created_at: string
  reason: string
  deleted_at: string | null
}

type MigrationStatus = {
  checked_at: string
  environment: {
    db_path: string
    db_path_exists: boolean
    backup_dir: string
    backup_dir_exists: boolean
    backup_dir_writable: boolean
  }
  database_health: {
    quick_check: string
    integrity_ok: boolean
  }
  migration: {
    legacy_assignments: number
    normalized_assignments: number
    migrated_from_legacy: number
    legacy_without_normalized_match: number
  }
  scheduling: {
    availability_slots: number
    assignments_with_schedule: number
  }
  backups: {
    tracked_backups: number
    backup_files_on_disk: number
  }
}

type LegacyMigrationResult = {
  success: boolean
  dry_run: boolean
  include_details: boolean
  detail_limit: number
  scanned_assignments: number
  assignments_eligible: number
  assignments_with_no_notes: number
  assignments_with_no_hour_match: number
  assignments_with_invalid_days: number
  slots_planned_or_inserted: number
  sample: Array<{
    assignment_id: number
    dates: string[]
    start_hours: number[]
    slots: number
  }>
  details: Array<{
    assignment_id: number
    status: 'eligible' | 'no_notes' | 'no_hour_match' | 'invalid_days'
    source: 'assignment_notes' | 'legacy_notes' | 'none'
    date_count: number
    dates: string[]
    start_hours: number[]
    slots: number
    note: string
  }>
}

export default function AdminToolsPage({ currentUser }: Props) {
  const { data: migrationRaw, trigger: loadMigrationStatus, loading: loadingMigration, error: migrationError } = useGetMigrationStatus()
  const { trigger: migrateLegacyNotes, loading: runningLegacyMigration, error: legacyMigrationError } = useMigrateLegacyVolunteerNotes()
  const { data: backupsRaw, trigger: loadBackups, loading: loadingBackups, error: backupsError } = useListBackups()
  const { trigger: createBackup, loading: creatingBackup } = useCreateBackup()
  const { trigger: deleteBackup, loading: deletingBackup } = useDeleteBackup()

  const migrationStatus = (migrationRaw ?? null) as MigrationStatus | null
  const backups = (backupsRaw ?? []) as DbBackup[]

  const [legacyResult, setLegacyResult] = useState<LegacyMigrationResult | null>(null)
  const [legacyError, setLegacyError] = useState('')

  useEffect(() => {
    void loadMigrationStatus({})
    void loadBackups({})
  }, [loadMigrationStatus, loadBackups])

  if (currentUser.role !== 'admin') {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Admin access required.</p>
      </div>
    )
  }

  async function handleCreateBackup() {
    await createBackup({ reason: 'admin-ui' })
    void loadMigrationStatus({})
    void loadBackups({})
  }

  async function handleDeleteBackup(filename: string) {
    if (!confirm(`Delete backup ${filename}?`)) return
    await deleteBackup({ filename })
    void loadMigrationStatus({})
    void loadBackups({})
  }

  async function handleRefreshStatus() {
    await loadMigrationStatus({})
  }

  async function handleLegacyDryRun() {
    setLegacyError('')
    try {
      const result = await migrateLegacyNotes({ dry_run: true, include_details: true, detail_limit: 5000 })
      setLegacyResult(result as LegacyMigrationResult)
    } catch (error) {
      setLegacyError(error instanceof Error ? error.message : 'Dry run failed')
    }
  }

  async function handleLegacyApply() {
    if (!confirm('Apply legacy note migration now?')) return
    setLegacyError('')
    try {
      const result = await migrateLegacyNotes({ dry_run: false, include_details: true, detail_limit: 5000 })
      setLegacyResult(result as LegacyMigrationResult)
      await loadMigrationStatus({})
    } catch (error) {
      setLegacyError(error instanceof Error ? error.message : 'Migration failed')
    }
  }

  function toCsvCell(value: string): string {
    return `"${value.replace(/"/g, '""')}"`
  }

  function handleExportLegacyCsv() {
    if (!legacyResult || legacyResult.details.length === 0) {
      setLegacyError('Run dry run first to export CSV details')
      return
    }

    const header = [
      'assignment_id',
      'status',
      'source',
      'date_count',
      'dates',
      'start_hours',
      'slots',
      'note',
    ]

    const rows = legacyResult.details.map((item) => [
      String(item.assignment_id),
      item.status,
      item.source,
      String(item.date_count),
      item.dates.join('|'),
      item.start_hours.join('|'),
      String(item.slots),
      item.note,
    ])

    const csv = [header, ...rows]
      .map((line) => line.map((cell) => toCsvCell(cell)).join(','))
      .join('\n')

    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const filename = `legacy-volunteer-note-migration-${stamp}.csv`
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="p-6 space-y-6">
      <div className="rounded-xl border border-primary/25 bg-primary/5 p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="rounded-full bg-primary/10 p-2 text-primary">
            <Shield className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">Admin Tools</h1>
              <Badge variant="secondary">Primary admin area</Badge>
            </div>
            <p className="text-muted-foreground text-sm">Migration status, backup management, and legacy volunteer scheduling helpers.</p>
          </div>
        </div>
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Migration Status</h2>
          <Button onClick={handleRefreshStatus} disabled={loadingMigration} className="h-8 px-3 text-xs" variant="outline">
            {loadingMigration ? 'Refreshing…' : 'Refresh Status'}
          </Button>
        </div>

        {migrationError ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            <p className="font-medium">Unable to load migration status.</p>
            <p className="mt-1">{migrationError.message}</p>
          </div>
        ) : !migrationStatus ? (
          <p className="text-sm text-muted-foreground">Loading migration status…</p>
        ) : (
          <div className="border rounded-lg p-3 space-y-3">
            <p className="text-xs text-muted-foreground">Last checked: {new Date(migrationStatus.checked_at).toLocaleString('en-GB')}</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
              <p>DB file: <span className={migrationStatus.environment.db_path_exists ? 'text-green-700 dark:text-green-400' : 'text-destructive'}>{migrationStatus.environment.db_path_exists ? 'found' : 'missing'}</span></p>
              <p>Backup dir: <span className={migrationStatus.environment.backup_dir_exists ? 'text-green-700 dark:text-green-400' : 'text-destructive'}>{migrationStatus.environment.backup_dir_exists ? 'found' : 'missing'}</span></p>
              <p>Backup writable: <span className={migrationStatus.environment.backup_dir_writable ? 'text-green-700 dark:text-green-400' : 'text-destructive'}>{migrationStatus.environment.backup_dir_writable ? 'yes' : 'no'}</span></p>
              <p>DB integrity: <span className={migrationStatus.database_health.integrity_ok ? 'text-green-700 dark:text-green-400' : 'text-destructive'}>{migrationStatus.database_health.quick_check}</span></p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
              <p>Legacy assignments: <span className="font-medium">{migrationStatus.migration.legacy_assignments}</span></p>
              <p>Normalized assignments: <span className="font-medium">{migrationStatus.migration.normalized_assignments}</span></p>
              <p>Pending legacy matches: <span className="font-medium">{migrationStatus.migration.legacy_without_normalized_match}</span></p>
              <p>Migrated from legacy: <span className="font-medium">{migrationStatus.migration.migrated_from_legacy}</span></p>
              <p>Assignments with schedule: <span className="font-medium">0</span></p>
              <p>Availability slots: <span className="font-medium">0</span></p>
              <p>Tracked backups: <span className="font-medium">{migrationStatus.backups.tracked_backups}</span></p>
              <p>Backup files on disk: <span className="font-medium">{migrationStatus.backups.backup_files_on_disk}</span></p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" className="h-8 px-3 text-xs" onClick={handleLegacyDryRun} disabled={runningLegacyMigration}>
                {runningLegacyMigration ? 'Running…' : 'Dry Run Legacy Note Migration'}
              </Button>
              <Button type="button" className="h-8 px-3 text-xs" onClick={handleLegacyApply} disabled={runningLegacyMigration}>
                Apply Legacy Note Migration
              </Button>
              <Button type="button" variant="outline" className="h-8 px-3 text-xs" onClick={handleExportLegacyCsv} disabled={!legacyResult || legacyResult.details.length === 0 || runningLegacyMigration}>
                Export CSV
              </Button>
            </div>

            {(legacyError || legacyMigrationError) && (
              <p className="text-sm text-destructive">{legacyError || legacyMigrationError?.message}</p>
            )}

            {legacyResult && (
              <div className="rounded-md border border-border p-3 space-y-2 text-sm bg-muted/30">
                <p className="font-medium">{legacyResult.dry_run ? 'Dry run result' : 'Migration result'}</p>
                <p>Scanned assignments: <span className="font-medium">{legacyResult.scanned_assignments}</span></p>
                <p>Eligible assignments: <span className="font-medium">{legacyResult.assignments_eligible}</span></p>
                <p>No notes: <span className="font-medium">{legacyResult.assignments_with_no_notes}</span></p>
                <p>No hour match: <span className="font-medium">{legacyResult.assignments_with_no_hour_match}</span></p>
                <p>Invalid day set: <span className="font-medium">{legacyResult.assignments_with_invalid_days}</span></p>
                <p>Slots {legacyResult.dry_run ? 'planned' : 'inserted'}: <span className="font-medium">{legacyResult.slots_planned_or_inserted}</span></p>
                {legacyResult.sample.length > 0 && (
                  <div className="pt-1">
                    <p className="text-xs text-muted-foreground">Sample assignments:</p>
                    {legacyResult.sample.map((item) => (
                      <p key={item.assignment_id} className="text-xs text-muted-foreground">
                        #{item.assignment_id} · dates {item.dates.join(', ')} · hours {item.start_hours.join(', ')}
                      </p>
                    ))}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Detailed rows available for export: {legacyResult.details.length}
                  {legacyResult.details.length === legacyResult.detail_limit ? ' (limit reached)' : ''}
                </p>
              </div>
            )}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Database Backups ({backups.length})</h2>
          <Button onClick={handleCreateBackup} disabled={creatingBackup} className="h-8 px-3 text-xs">
            {creatingBackup ? 'Creating…' : 'Create Backup'}
          </Button>
        </div>

        {backupsError ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            <p className="font-medium">Unable to load backups.</p>
            <p className="mt-1">{backupsError.message}</p>
          </div>
        ) : loadingBackups ? (
          <p className="text-sm text-muted-foreground">Loading backups…</p>
        ) : backups.length === 0 ? (
          <p className="text-sm text-muted-foreground">No backup files found.</p>
        ) : (
          <div className="border rounded-lg divide-y">
            {backups.map((backup) => (
              <div key={backup.filename} className="p-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{backup.filename}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(backup.created_at).toLocaleString('en-GB')} · {(backup.byte_size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                  aria-label={`Delete backup ${backup.filename}`}
                  onClick={() => handleDeleteBackup(backup.filename)}
                  disabled={deletingBackup}
                >
                  <span className="sr-only">Delete backup</span>
                  <span className="text-sm">×</span>
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
