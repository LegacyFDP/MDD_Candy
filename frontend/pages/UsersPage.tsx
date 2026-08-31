import { useEffect, useState } from 'react'
import { useGetUsersWithFetes, useSaveUser, useDeleteUser } from '../hooks/backend/fete'
import { Button } from '../lib/shadcn/button'
import { Input } from '../lib/shadcn/input'
import { Label } from '../lib/shadcn/label'
import { Badge } from '../lib/shadcn/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../lib/shadcn/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../lib/shadcn/select'
import { Plus, Pencil, Trash2, Shield, User, Calendar, Eye, EyeOff, Search } from 'lucide-react'
import type { AppUser } from './Login'

interface Props { currentUser: AppUser }

type FeteAllocation = {
  fete_id: number
  fete_name: string
  event_date: string
  fete_status: string
  notes: string
}

type FeteUser = {
  id: number
  name: string
  email: string
  role: 'admin' | 'store keeper' | 'user'
  pin: string
  fetes: FeteAllocation[]
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

  const users = (usersRaw ?? []) as FeteUser[]

  const [open, setOpen] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [showPin, setShowPin] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [form, setForm] = useState<Partial<FeteUser>>({
    name: '', email: '', role: 'user', pin: ''
  })

  useEffect(() => { void loadUsers({}) }, [])

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

  const visibleUsers = selectedUserId === 'all'
    ? users
    : users.filter(user => user.id === Number(selectedUserId))
  const matchingUsers = users.filter(user => {
    const query = searchTerm.trim().toLowerCase()
    return !query || [user.name, user.email].some(value => value.toLowerCase().includes(query))
  })
  const admins = visibleUsers.filter(u => u.role === 'admin')
  const storeKeepers = visibleUsers.filter(u => u.role === 'store keeper')
  const regularUsers = visibleUsers.filter(u => u.role === 'user')

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">User Management</h1>
          <p className="text-muted-foreground text-sm">Manage admins, store keepers, and users · {users.length} total</p>
        </div>
        <Button onClick={openNew} className="flex items-center gap-2">
          <Plus className="w-4 h-4" /> Add User
        </Button>
      </div>

      <div className="relative max-w-md">
        <Label htmlFor="user-search">Search users</Label>
        <Search className="absolute left-3 top-9 w-4 h-4 text-muted-foreground" />
        <Input
          id="user-search"
          value={searchTerm}
          onChange={event => {
            setSearchTerm(event.target.value)
            setSelectedUserId('all')
            setSearchOpen(true)
          }}
          onFocus={() => setSearchOpen(true)}
          onBlur={() => window.setTimeout(() => setSearchOpen(false), 150)}
          placeholder="Search by name or email"
          aria-label="Search users"
          aria-expanded={searchOpen}
          aria-controls="user-search-results"
          className="mt-1 pl-9"
        />
        {searchOpen && (
          <div id="user-search-results" className="absolute z-10 mt-1 max-h-64 w-full overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md">
            <button
              type="button"
              className="w-full rounded-sm px-2 py-2 text-left text-sm hover:bg-accent"
              onMouseDown={() => {
                setSelectedUserId('all')
                setSearchTerm('')
                setSearchOpen(false)
              }}>
              All users
            </button>
            {matchingUsers.map(user => (
              <button
                key={user.id}
                type="button"
                className="w-full rounded-sm px-2 py-2 text-left hover:bg-accent"
                onMouseDown={() => {
                  setSelectedUserId(String(user.id))
                  setSearchTerm(user.name)
                  setSearchOpen(false)
                }}>
                <span className="block text-sm font-medium">{user.name}</span>
                <span className="block text-xs text-muted-foreground">{user.email}</span>
              </button>
            ))}
            {matchingUsers.length === 0 && (
              <p className="px-2 py-4 text-center text-sm text-muted-foreground">No users found.</p>
            )}
          </div>
        )}
      </div>

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

      {/* Store keepers */}
      <section>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
          <Shield className="w-4 h-4" /> Store keepers ({storeKeepers.length})
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {storeKeepers.map(u => (
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
                onValueChange={v => setForm(f => ({ ...f, role: v as 'admin' | 'store keeper' | 'user' }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="store keeper">Store keeper</SelectItem>
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
        <div className={`p-2 rounded-full shrink-0 ${user.role === 'admin' || user.role === 'store keeper' ? 'bg-primary/10' : 'bg-muted'}`}>
          {user.role === 'admin' || user.role === 'store keeper'
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
        <p className="text-xs text-muted-foreground pl-1 italic">No event history</p>
      )}
    </div>
  )
}
