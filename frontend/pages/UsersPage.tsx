import { useEffect, useState } from 'react'
import {
  useGetPeople, useSavePerson, useDeletePerson, useMergePeople, useGetFetes,
} from '../hooks/backend/fete'
import { Button } from '../lib/shadcn/button'
import { Input } from '../lib/shadcn/input'
import { Label } from '../lib/shadcn/label'
import { Badge } from '../lib/shadcn/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../lib/shadcn/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../lib/shadcn/select'
import { Plus, Pencil, Trash2, Eye, EyeOff, Search, GitMerge } from 'lucide-react'
import type { AppUser } from './Login'

interface Props { currentUser: AppUser }

type PersonRole = 'Admin' | 'Store Keeper' | 'User' | 'Volunteer' | 'Contact'

const PERSON_ROLES: PersonRole[] = ['Admin', 'Store Keeper', 'User', 'Volunteer', 'Contact']
const ACCOUNT_ROLES: PersonRole[] = ['User', 'Admin', 'Store Keeper']
const VOLUNTEER_ROLES = ['Lead Volunteer', 'Helper', 'Putting Up', 'Taking Down', 'Transport', 'Stall Holder']

type Person = {
  id: number
  name: string
  email: string
  phone: string
  notes: string
  roles: PersonRole[]
  user_id: number | null
  pin: string
  volunteer_id: number | null
  volunteer_roles: string[]
  contact_id: number | null
  contact_fete_ids: number[]
  contact_fete_names: string[]
  created_fetes: { fete_id: number; fete_name: string }[]
}

type Fete = { id: number; name: string }

type PersonForm = {
  id: number | null
  name: string
  email: string
  phone: string
  notes: string
  roles: PersonRole[]
  pin: string
  volunteerRoles: string[]
  contactEventIds: number[]
}

const emptyPersonForm = (): PersonForm => ({
  id: null, name: '', email: '', phone: '', notes: '', roles: ['User'], pin: '', volunteerRoles: [], contactEventIds: [],
})

function personDetails(person: Person): string {
  return [
    person.roles.includes('Volunteer') ? person.volunteer_roles.join(', ') : '',
    person.roles.includes('Contact') ? person.contact_fete_names.join(', ') : '',
    person.created_fetes.map(f => f.fete_name).join(', '),
  ].filter(Boolean).join(' · ')
}

export default function UsersPage({ currentUser }: Props) {
  const { data: peopleRaw, trigger: loadPeople } = useGetPeople()
  const { trigger: savePerson, loading: saving } = useSavePerson()
  const { trigger: deletePerson } = useDeletePerson()
  const { trigger: mergePeople, loading: merging } = useMergePeople()
  const { data: fetesRaw, trigger: loadFetes } = useGetFetes()

  const people = (peopleRaw ?? []) as Person[]
  const fetes = (fetesRaw ?? []) as Fete[]

  const [open, setOpen] = useState(false)
  const [showPin, setShowPin] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [roleFilter, setRoleFilter] = useState<'all' | PersonRole>('all')
  const [form, setForm] = useState<PersonForm>(emptyPersonForm())
  const [mergeTarget, setMergeTarget] = useState<Person | null>(null)
  const [mergeSourceId, setMergeSourceId] = useState('')
  const [mergeError, setMergeError] = useState<string | null>(null)

  useEffect(() => {
    void loadPeople({})
    void loadFetes({})
  }, [])

  if (currentUser.role !== 'admin') {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Admin access required.</p>
      </div>
    )
  }

  const isSelf = (person: Person) => person.user_id === currentUser.id

  function openNew() {
    setForm(emptyPersonForm())
    setSaveError(null)
    setShowPin(false)
    setOpen(true)
  }

  function openEdit(person: Person) {
    setForm({
      id: person.id,
      name: person.name,
      email: person.email,
      phone: person.phone,
      notes: person.notes,
      roles: person.roles,
      pin: person.pin,
      volunteerRoles: person.volunteer_roles,
      contactEventIds: person.contact_fete_ids,
    })
    setSaveError(null)
    setShowPin(false)
    setOpen(true)
  }

  function toggleRole(role: PersonRole, checked: boolean) {
    setForm(f => ({ ...f, roles: checked ? [...f.roles, role] : f.roles.filter(item => item !== role) }))
  }

  const hasAccount = form.roles.some(role => ACCOUNT_ROLES.includes(role))
  const isVolunteer = form.roles.includes('Volunteer')
  const isContact = form.roles.includes('Contact')
  const editing = people.find(person => person.id === form.id)
  const removingOwnAccess = Boolean(editing && isSelf(editing) && !form.roles.includes('Admin'))

  async function handleSave() {
    setSaveError(null)
    try {
      await savePerson({
        id: form.id ?? undefined,
        name: form.name,
        email: form.email,
        phone: form.phone,
        notes: form.notes,
        roles: form.roles,
        pin: hasAccount ? form.pin : '',
        volunteer_roles: isVolunteer ? form.volunteerRoles : [],
        contact_fete_ids: isContact ? form.contactEventIds : [],
      })
      setOpen(false)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err))
    }
    void loadPeople({})
  }

  async function handleDelete(person: Person) {
    if (isSelf(person)) return alert('Cannot delete yourself.')
    if (!confirm(`Delete ${person.name} (${person.roles.join(', ')})?`)) return
    try {
      await deletePerson({ id: person.id })
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err))
    }
    void loadPeople({})
  }

  async function handleMerge() {
    if (!mergeTarget || !mergeSourceId) return
    setMergeError(null)
    try {
      await mergePeople({ keep_id: mergeTarget.id, merge_id: Number(mergeSourceId) })
      setMergeTarget(null)
      setMergeSourceId('')
    } catch (err) {
      setMergeError(err instanceof Error ? err.message : String(err))
    }
    void loadPeople({})
  }

  const query = searchTerm.trim().toLowerCase()
  const visiblePeople = people
    .filter(person => roleFilter === 'all' || person.roles.includes(roleFilter))
    .filter(person => !query || [person.name, person.email, person.phone].some(value => (value ?? '').toLowerCase().includes(query)))

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">People Management</h1>
          <p className="text-muted-foreground text-sm">One record per person, with any combination of roles</p>
        </div>
        <Button onClick={openNew} className="flex items-center gap-2">
          <Plus className="w-4 h-4" /> Add Person
        </Button>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="relative w-full max-w-md">
          <Label htmlFor="user-search">Search people</Label>
          <Search className="absolute left-3 top-9 w-4 h-4 text-muted-foreground" />
          <Input
            id="user-search"
            value={searchTerm}
            onChange={event => setSearchTerm(event.target.value)}
            placeholder="Search by name, email or phone"
            className="mt-1 pl-9"
          />
        </div>
        <div className="w-48">
          <Label>Role</Label>
          <Select value={roleFilter} onValueChange={value => setRoleFilter(value as 'all' | PersonRole)}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All roles</SelectItem>
              {PERSON_ROLES.map(role => <SelectItem key={role} value={role}>{role}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="border rounded-lg bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Name</th>
              <th className="px-3 py-2 font-medium">Roles</th>
              <th className="px-3 py-2 font-medium">Email</th>
              <th className="px-3 py-2 font-medium">Phone</th>
              <th className="hidden lg:table-cell px-3 py-2 font-medium">Details</th>
              <th className="px-3 py-2 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {visiblePeople.map(person => (
              <tr key={person.id}>
                <td className="px-3 py-2 font-medium">
                  {person.name}
                  {isSelf(person) && <Badge variant="outline" className="ml-2 text-xs">You</Badge>}
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    {PERSON_ROLES.filter(role => person.roles.includes(role)).map(role => <Badge key={role} variant="secondary">{role}</Badge>)}
                  </div>
                </td>
                <td className="px-3 py-2">{person.email || '—'}</td>
                <td className="px-3 py-2">{person.phone || '—'}</td>
                <td className="hidden lg:table-cell px-3 py-2 text-muted-foreground max-w-xs truncate">{personDetails(person) || '—'}</td>
                <td className="px-3 py-2">
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="outline" onClick={() => openEdit(person)} aria-label={`Edit ${person.name}`}>
                      <Pencil className="w-3 h-3" />
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => { setMergeTarget(person); setMergeSourceId(''); setMergeError(null) }}
                      aria-label={`Merge another person into ${person.name}`} title="Merge a duplicate into this person">
                      <GitMerge className="w-3 h-3" />
                    </Button>
                    <Button size="sm" variant="outline" className="text-destructive hover:text-destructive"
                      onClick={() => void handleDelete(person)} aria-label={`Delete ${person.name}`}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {visiblePeople.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">No people found.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{form.id ? 'Edit Person' : 'Add Person'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Full Name</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Roles (select all that apply)</Label>
              <div className="flex flex-wrap gap-x-6 gap-y-2">
                {PERSON_ROLES.map(role => (
                  <Label key={role} className="flex items-center gap-2 font-normal">
                    <input type="checkbox" checked={form.roles.includes(role)} onChange={e => toggleRole(role, e.target.checked)} />
                    {role}
                  </Label>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">User, Admin and Store Keeper give the person a login. Admin can do everything a Store Keeper can.</p>
            </div>
            <div className="space-y-1">
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            </div>
            <div className="space-y-1"><Label>Phone</Label><Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
            {hasAccount && (
              <div className="space-y-1">
                <Label>PIN (up to 6 digits)</Label>
                <div className="relative">
                  <Input
                    type={showPin ? 'text' : 'password'}
                    maxLength={6}
                    className="pr-10"
                    value={form.pin}
                    onChange={e => setForm(f => ({ ...f, pin: e.target.value }))}
                    placeholder="••••" />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 px-3 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowPin(v => !v)}
                    aria-label={showPin ? 'Hide PIN' : 'Show PIN'}>
                    {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}
            {isVolunteer && (
              <div className="space-y-2">
                <Label>Willing volunteer roles</Label>
                <div className="grid grid-cols-2 gap-2">
                  {VOLUNTEER_ROLES.map(role => (
                    <Label key={role} className="flex items-center gap-2 text-sm font-normal">
                      <input type="checkbox" checked={form.volunteerRoles.includes(role)}
                        onChange={event => setForm(f => ({ ...f, volunteerRoles: event.target.checked ? [...f.volunteerRoles, role] : f.volunteerRoles.filter(item => item !== role) }))} />
                      {role}
                    </Label>
                  ))}
                </div>
              </div>
            )}
            <div className="space-y-1"><Label>Notes</Label><Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div>
            {isContact && (
              <div className="space-y-2">
                <Label>Related events</Label>
                <div className="grid grid-cols-2 gap-2">
                  {fetes.map(fete => (
                    <Label key={fete.id} className="flex items-center gap-2 text-sm font-normal">
                      <input type="checkbox" checked={form.contactEventIds.includes(fete.id)}
                        onChange={event => setForm(f => ({ ...f, contactEventIds: event.target.checked ? [...f.contactEventIds, fete.id] : f.contactEventIds.filter(id => id !== fete.id) }))} />
                      {fete.name}
                    </Label>
                  ))}
                </div>
              </div>
            )}
          </div>
          {removingOwnAccess && <p className="text-sm text-destructive" role="alert">You cannot remove your own Admin role.</p>}
          {saveError && <p className="text-sm text-destructive" role="alert">{saveError}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => void handleSave()} disabled={saving || removingOwnAccess || !form.name.trim() || form.roles.length === 0 || (hasAccount && (!form.email.trim() || !form.pin)) || (isContact && form.contactEventIds.length === 0)}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(mergeTarget)} onOpenChange={value => { if (!value) setMergeTarget(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Merge duplicate into {mergeTarget?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              The person you pick is removed. Their roles, rota shifts and events move to {mergeTarget?.name}.
            </p>
            <Select value={mergeSourceId} onValueChange={setMergeSourceId}>
              <SelectTrigger><SelectValue placeholder="Choose the duplicate" /></SelectTrigger>
              <SelectContent>
                {people.filter(person => person.id !== mergeTarget?.id).map(person => (
                  <SelectItem key={person.id} value={String(person.id)}>
                    {person.name}{person.email ? ` (${person.email})` : ''} — {person.roles.join(', ')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {mergeError && <p className="text-sm text-destructive" role="alert">{mergeError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMergeTarget(null)}>Cancel</Button>
            <Button onClick={() => void handleMerge()} disabled={!mergeSourceId || merging}>{merging ? 'Merging…' : 'Merge'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
