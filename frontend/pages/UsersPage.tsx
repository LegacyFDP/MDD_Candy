import { useEffect, useState } from 'react'
import {
  useGetUsersWithFetes,
  useSaveUser,
  useDeleteUser,
  useGetMigrationStatus,
  useMigrateLegacyVolunteerNotes,
  useListBackups,
  useCreateBackup,
  useDeleteBackup,
} from '../hooks/backend/fete'
import { Button } from '../lib/shadcn/button'
import { Input } from '../lib/shadcn/input'
import { Label } from '../lib/shadcn/label'
import { Badge } from '../lib/shadcn/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../lib/shadcn/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../lib/shadcn/select'
import { Plus, Pencil, Trash2, Shield, User, Calendar, Eye, EyeOff } from 'lucide-react'
import type { AppUser } from './Login'

interface Props { currentUser: AppUser }

type FeteAllocation = {
  fete_id: number
  fete_name: string
  event_date: string
  fete_status: string
  volunteer_role: string
  notes: string
}

type FeteUser = {
  id: number
  name: string
  email: string
  role: 'admin' | 'user'
  pin: string
  fetes: FeteAllocation[]
}

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

const STATUS_COLORS: Record<string, string> = {
  planned:   'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  active:    'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  completed: 'bg-muted text-muted-foreground',
  cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
}

export default function UsersPage({ currentUser }: Props) {
  const { data: usersRaw, trigger: loadUsers } = useGetUsersWithFetes()
  const { trigger: saveUser, loading: saving } = useSaveUser()
  const { trigger: deleteUser } = useDeleteUser()
  const { data: migrationRaw, trigger: loadMigrationStatus, loading: loadingMigration } = useGetMigrationStatus()
  const { trigger: migrateLegacyNotes, loading: runningLegacyMigration } = useMigrateLegacyVolunteerNotes()
  const { data: backupsRaw, trigger: loadBackups, loading: loadingBackups } = useListBackups()
  const { trigger: createBackup, loading: creatingBackup } = useCreateBackup()
  const { trigger: deleteBackup, loading: deletingBackup } = useDeleteBackup()

  const users = (usersRaw ?? []) as FeteUser[]
  const migrationStatus = (migrationRaw ?? null) as MigrationStatus | null
  const backups = (backupsRaw ?? []) as DbBackup[]

  const [open, setOpen] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [showPin, setShowPin] = useState(false)
  const [form, setForm] = useState<Partial<FeteUser>>({
    name: '', email: '', role: 'user', pin: ''
  })
  const [legacyResult, setLegacyResult] = useState<LegacyMigrationResult | null>(null)
  const [legacyError, setLegacyError] = useState('')

  useEffect(() => {
    void loadUsers({})
    void loadMigrationStatus({})
    void loadBackups({})
  }, [])

  if (currentUser.role !== 'admin') {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Admin access required.</p>
      </div>
    )
  }

  function openNew() {
    setForm({ name: '', email: '', role: 'user', pin: '' })
    setEditId(null)
    setShowPin(false)
    setOpen(true)
  }

  function openEdit(u: FeteUser) {
    setForm({ id: u.id, name: u.name, email: u.email, role: u.role, pin: u.pin })
    setEditId(u.id)
    setShowPin(false)
    setOpen(true)
  }

  async function handleSave() {
    await saveUser({
      ...(editId ? { id: editId } : {}),
      name: form.name ?? '',
      email: form.email ?? '',
      role: form.role ?? 'user',
      pin: form.pin ?? ''
    })
    setOpen(false)
    void loadUsers({})
  }

  async function handleDelete(id: number) {
    if (id === currentUser.id) return alert('Cannot delete yourself.')
    if (!confirm('Delete this user?')) return
    await deleteUser({ id })
    void loadUsers({})
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
    if (!confirm('Apply legacy note migration now? This will write availability slots.')) return
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

  const admins = users.filter(u => u.role === 'admin')
  const regularUsers = users.filter(u => u.role === 'user')

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">User Management</h1>
          <p className="text-muted-foreground text-sm">Manage admins and users · {users.length} total</p>
        </div>
        <Button onClick={openNew} className="flex items-center gap-2">
          <Plus className="w-4 h-4" /> Add User
        </Button>
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Migration Status
          </h2>
          <Button onClick={handleRefreshStatus} disabled={loadingMigration} className="h-8 px-3 text-xs" variant="outline">
            {loadingMigration ? 'Refreshing…' : 'Refresh Status'}
          </Button>
        </div>

        {!migrationStatus ? (
          <p className="text-sm text-muted-foreground">Loading migration status…</p>
        ) : (
          <div className="border rounded-lg p-3 space-y-3">
            <p className="text-xs text-muted-foreground">
              Last checked: {new Date(migrationStatus.checked_at).toLocaleString('en-GB')}
            </p>

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
              <p>Assignments with schedule: <span className="font-medium">{migrationStatus.scheduling.assignments_with_schedule}</span></p>
              <p>Availability slots: <span className="font-medium">{migrationStatus.scheduling.availability_slots}</span></p>
              <p>Tracked backups: <span className="font-medium">{migrationStatus.backups.tracked_backups}</span></p>
              <p>Backup files on disk: <span className="font-medium">{migrationStatus.backups.backup_files_on_disk}</span></p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-8 px-3 text-xs"
                onClick={handleLegacyDryRun}
                disabled={runningLegacyMigration}
              >
                {runningLegacyMigration ? 'Running…' : 'Dry Run Legacy Note Migration'}
              </Button>
              <Button
                type="button"
                className="h-8 px-3 text-xs"
                onClick={handleLegacyApply}
                disabled={runningLegacyMigration}
              >
                Apply Legacy Note Migration
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-8 px-3 text-xs"
                onClick={handleExportLegacyCsv}
                disabled={!legacyResult || legacyResult.details.length === 0 || runningLegacyMigration}
              >
                Export CSV
              </Button>
            </div>

            {legacyError && <p className="text-sm text-destructive">{legacyError}</p>}

            {legacyResult && (
              <div className="rounded-md border border-border p-3 space-y-2 text-sm bg-muted/30">
                <p className="font-medium">
                  {legacyResult.dry_run ? 'Dry run result' : 'Migration result'}
                </p>
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
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Database Backups ({backups.length})
          </h2>
          <Button onClick={handleCreateBackup} disabled={creatingBackup} className="h-8 px-3 text-xs">
            {creatingBackup ? 'Creating…' : 'Create Backup'}
          </Button>
        </div>

        {loadingBackups ? (
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
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Admins */}
      <section>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
          <Shield className="w-4 h-4" /> Admins ({admins.length})
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {admins.map(u => (
            <UserCard key={u.id} user={u} currentUser={currentUser}
              onEdit={openEdit} onDelete={handleDelete} />
          ))}
        </div>
      </section>

      {/* Regular users */}
      <section>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
          <User className="w-4 h-4" /> Users ({regularUsers.length})
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {regularUsers.map(u => (
            <UserCard key={u.id} user={u} currentUser={currentUser}
              onEdit={openEdit} onDelete={handleDelete} />
          ))}
        </div>
      </section>

      {/* Edit / Add dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editId ? 'Edit User' : 'Add New User'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Full Name</Label>
              <Input value={form.name ?? ''}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Email</Label>
              <Input type="email" value={form.email ?? ''}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Role</Label>
              <Select
                {...(form.role ? { value: form.role } : {})}
                onValueChange={v => setForm(f => ({ ...f, role: v as 'admin' | 'user' }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="user">User</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>PIN (up to 6 digits)</Label>
              <div className="relative">
                <Input
                  type={showPin ? 'text' : 'password'}
                  maxLength={6}
                  className="pr-10"
                  value={form.pin ?? ''}
                  onChange={e => setForm(f => ({ ...f, pin: e.target.value }))}
                  placeholder="••••" />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 px-3 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPin((v) => !v)}
                  aria-label={showPin ? 'Hide PIN' : 'Show PIN'}>
                  {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.name || !form.email || !form.pin}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function UserCard({
  user, currentUser, onEdit, onDelete
}: {
  user: FeteUser
  currentUser: AppUser
  onEdit: (u: FeteUser) => void
  onDelete: (id: number) => void
}) {
  return (
    <div className="border rounded-lg p-4 bg-card text-card-foreground space-y-3">
      {/* User identity row */}
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-full shrink-0 ${user.role === 'admin' ? 'bg-primary/10' : 'bg-muted'}`}>
          {user.role === 'admin'
            ? <Shield className="w-5 h-5 text-primary" />
            : <User className="w-5 h-5 text-muted-foreground" />
          }
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium truncate">{user.name}</span>
            {user.id === currentUser.id && (
              <Badge variant="outline" className="text-xs shrink-0">You</Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground truncate">{user.email}</p>
        </div>
        <div className="flex gap-1 shrink-0">
          <Button size="sm" variant="outline" onClick={() => onEdit(user)} aria-label="Edit user">
            <Pencil className="w-3 h-3" />
          </Button>
          <Button size="sm" variant="outline"
            className="text-destructive hover:text-destructive"
            onClick={() => onDelete(user.id)}
            aria-label="Delete user">
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      </div>

      {/* Fete allocations */}
      {user.fetes.length > 0 ? (
        <div className="space-y-1.5 pl-1">
          {user.fetes.map(f => (
            <div key={f.fete_id}
              className="flex items-start gap-2 text-sm rounded-md border bg-muted/40 px-3 py-2">
              <Calendar className="w-3.5 h-3.5 mt-0.5 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="font-medium">{f.fete_name}</span>
                <span className="text-muted-foreground"> · {f.volunteer_role}</span>
                {f.notes && (
                  <p className="text-xs text-muted-foreground truncate">{f.notes}</p>
                )}
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium capitalize ${STATUS_COLORS[f.fete_status] ?? 'bg-muted text-muted-foreground'}`}>
                  {f.fete_status}
                </span>
                <span className="text-xs text-muted-foreground">
                  {new Date(f.event_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground pl-1 italic">Not allocated to any fete</p>
      )}
    </div>
  )
}
