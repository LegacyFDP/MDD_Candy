import { useEffect, useState } from 'react'
import {
  useGetUsersWithFetes, useSaveUser, useDeleteUser,
  useGetVolunteers, useSaveVolunteer, useDeleteVolunteer,
  useGetContacts, useSaveContact, useDeleteContact, useGetFetes,
} from '../hooks/backend/fete'
import { Button } from '../lib/shadcn/button'
import { Input } from '../lib/shadcn/input'
import { Label } from '../lib/shadcn/label'
import { Badge } from '../lib/shadcn/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../lib/shadcn/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../lib/shadcn/select'
import { Plus, Pencil, Trash2, Eye, EyeOff, Search } from 'lucide-react'
import type { AppUser } from './Login'

interface Props { currentUser: AppUser }

type FeteAllocation = {
  fete_id: number
  fete_name: string
  event_date: string | null
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

type Volunteer = {
  id: number
  name: string
  email: string
  phone: string
  roles: string[]
  notes: string
}

type Contact = {
  id: number
  name: string
  email: string
  phone: string
  notes: string
  fete_ids: number[]
  fete_names: string[]
}

type Fete = { id: number; name: string }

type PersonForm = {
  userId: number | null
  volunteerId: number | null
  contactId: number | null
  isUser: boolean
  isVolunteer: boolean
  isContact: boolean
  name: string
  email: string
  userRole: FeteUser['role']
  pin: string
  phone: string
  volunteerRoles: string[]
  notes: string
  contactEventIds: number[]
}

const VOLUNTEER_ROLES = ['Lead Volunteer', 'Helper', 'Putting Up', 'Taking Down', 'Transport', 'Stall Holder']

const emptyPersonForm = (): PersonForm => ({
  userId: null, volunteerId: null, contactId: null, isUser: true, isVolunteer: false, isContact: false,
  name: '', email: '', userRole: 'user', pin: '', phone: '', volunteerRoles: [], notes: '', contactEventIds: [],
})

type PersonRole = 'Admin' | 'Store Keeper' | 'User' | 'Volunteer' | 'Contact'

const PERSON_ROLES: PersonRole[] = ['Admin', 'Store Keeper', 'User', 'Volunteer', 'Contact']

const USER_ROLE_LABELS: Record<FeteUser['role'], PersonRole> = {
  admin: 'Admin',
  'store keeper': 'Store Keeper',
  user: 'User',
}

type PersonRow = {
  key: string
  role: PersonRole
  name: string
  email: string
  phone: string
  details: string
  user?: FeteUser
  volunteer?: Volunteer
  contact?: Contact
}

export default function UsersPage({ currentUser }: Props) {
  const { data: usersRaw, trigger: loadUsers } = useGetUsersWithFetes()
  const { trigger: saveUser, loading: saving } = useSaveUser()
  const { trigger: deleteUser } = useDeleteUser()
  const { data: volunteersRaw, trigger: loadVolunteers } = useGetVolunteers()
  const { trigger: saveVolunteer, loading: savingVolunteer } = useSaveVolunteer()
  const { trigger: deleteVolunteer } = useDeleteVolunteer()
  const { data: contactsRaw, trigger: loadContacts } = useGetContacts()
  const { trigger: saveContact, loading: savingContact } = useSaveContact()
  const { trigger: deleteContact } = useDeleteContact()
  const { data: fetesRaw, trigger: loadFetes } = useGetFetes()

  const users = (usersRaw ?? []) as FeteUser[]
  const volunteers = (volunteersRaw ?? []) as Volunteer[]
  const contacts = (contactsRaw ?? []) as Contact[]
  const fetes = (fetesRaw ?? []) as Fete[]

  const [open, setOpen] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [showPin, setShowPin] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [roleFilter, setRoleFilter] = useState<'all' | PersonRole>('all')
  const [form, setForm] = useState<PersonForm>(emptyPersonForm())

  useEffect(() => {
    void loadUsers({})
    void loadVolunteers({})
    void loadContacts({})
    void loadFetes({})
  }, [])

  if (currentUser.role !== 'admin') {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Admin access required.</p>
      </div>
    )
  }

  function openNew() {
    setForm(emptyPersonForm())
    setEditId(null)
    setShowPin(false)
    setOpen(true)
  }

  function openEdit(u?: FeteUser, volunteer?: Volunteer, contact?: Contact) {
    const person = u ?? volunteer ?? contact
    if (!person) return
    setForm({
      userId: u?.id ?? null,
      volunteerId: volunteer?.id ?? null,
      contactId: contact?.id ?? null,
      isUser: Boolean(u),
      isVolunteer: Boolean(volunteer),
      isContact: Boolean(contact),
      name: person.name,
      email: u?.email ?? volunteer?.email ?? contact?.email ?? '',
      userRole: u?.role ?? 'user',
      pin: u?.pin ?? '',
      phone: volunteer?.phone ?? contact?.phone ?? '',
      volunteerRoles: volunteer?.roles ?? [],
      notes: volunteer?.notes ?? contact?.notes ?? '',
      contactEventIds: contact?.fete_ids ?? [],
    })
    setEditId(u?.id ?? null)
    setShowPin(false)
    setOpen(true)
  }

  async function handleSave() {
    if (!form.isUser && !form.isVolunteer && !form.isContact) return
    if (form.isUser) {
      await saveUser({ id: form.userId ?? undefined, name: form.name, email: form.email, role: form.userRole, pin: form.pin })
    } else if (form.userId) {
      if (form.userId === currentUser.id) throw new Error('Cannot remove your own user access.')
      await deleteUser({ id: form.userId })
    }
    if (form.isVolunteer) {
      await saveVolunteer({ id: form.volunteerId ?? undefined, name: form.name, email: form.email, phone: form.phone, roles: form.volunteerRoles, notes: form.notes })
    } else if (form.volunteerId) {
      await deleteVolunteer({ id: form.volunteerId })
    }
    if (form.isContact) {
      await saveContact({ id: form.contactId ?? undefined, name: form.name, email: form.email, phone: form.phone, notes: form.notes, fete_ids: form.contactEventIds })
    } else if (form.contactId) {
      await deleteContact({ id: form.contactId })
    }
    setOpen(false)
    void loadUsers({})
    void loadVolunteers({})
    void loadContacts({})
  }

  async function handleDelete(row: PersonRow) {
    if (row.user && row.user.id === currentUser.id) return alert('Cannot delete yourself.')
    if (!confirm(`Delete ${row.name} (${row.role})?`)) return
    if (row.user) await deleteUser({ id: row.user.id })
    else if (row.volunteer) await deleteVolunteer({ id: row.volunteer.id })
    else if (row.contact) await deleteContact({ id: row.contact.id })
    void loadUsers({})
    void loadVolunteers({})
    void loadContacts({})
  }

  const people: PersonRow[] = [
    ...users.map((user): PersonRow => ({
      key: `user-${user.id}`,
      role: USER_ROLE_LABELS[user.role] ?? 'User',
      name: user.name,
      email: user.email ?? '',
      phone: '',
      details: user.fetes.map(f => f.fete_name).join(', '),
      user,
    })),
    ...volunteers.map((volunteer): PersonRow => ({
      key: `volunteer-${volunteer.id}`,
      role: 'Volunteer',
      name: volunteer.name,
      email: volunteer.email ?? '',
      phone: volunteer.phone ?? '',
      details: volunteer.roles.join(', '),
      volunteer,
    })),
    ...contacts.map((contact): PersonRow => ({
      key: `contact-${contact.id}`,
      role: 'Contact',
      name: contact.name,
      email: contact.email ?? '',
      phone: contact.phone ?? '',
      details: contact.fete_names.join(', '),
      contact,
    })),
  ]

  const query = searchTerm.trim().toLowerCase()
  const visiblePeople = people
    .filter(row => roleFilter === 'all' || row.role === roleFilter)
    .filter(row => !query || [row.name, row.email, row.phone].some(value => value.toLowerCase().includes(query)))
    .sort((left, right) => left.name.localeCompare(right.name) || PERSON_ROLES.indexOf(left.role) - PERSON_ROLES.indexOf(right.role))

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">People Management</h1>
          <p className="text-muted-foreground text-sm">Manage user access and volunteers in one place</p>
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
              <th className="px-3 py-2 font-medium">Role</th>
              <th className="px-3 py-2 font-medium">Email</th>
              <th className="px-3 py-2 font-medium">Phone</th>
              <th className="hidden lg:table-cell px-3 py-2 font-medium">Details</th>
              <th className="px-3 py-2 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {visiblePeople.map(row => (
              <tr key={row.key}>
                <td className="px-3 py-2 font-medium">
                  {row.name}
                  {row.user?.id === currentUser.id && <Badge variant="outline" className="ml-2 text-xs">You</Badge>}
                </td>
                <td className="px-3 py-2"><Badge variant="secondary">{row.role}</Badge></td>
                <td className="px-3 py-2">{row.email || '—'}</td>
                <td className="px-3 py-2">{row.phone || '—'}</td>
                <td className="hidden lg:table-cell px-3 py-2 text-muted-foreground max-w-xs truncate">{row.details || '—'}</td>
                <td className="px-3 py-2">
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="outline" onClick={() => openEdit(row.user, row.volunteer, row.contact)} aria-label={`Edit ${row.name} (${row.role})`}>
                      <Pencil className="w-3 h-3" />
                    </Button>
                    <Button size="sm" variant="outline" className="text-destructive hover:text-destructive"
                      onClick={() => void handleDelete(row)} aria-label={`Delete ${row.name} (${row.role})`}>
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

      {/* Edit / Add dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editId || form.volunteerId ? 'Edit Person' : 'Add Person'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Full Name</Label>
              <Input value={form.name ?? ''}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Role</Label>
              <Select
                value={form.isUser ? form.userRole : form.isVolunteer ? 'volunteer' : 'contact'}
                onValueChange={v => setForm(f => ({
                  ...f,
                  isUser: v !== 'volunteer' && v !== 'contact',
                  isVolunteer: v === 'volunteer',
                  isContact: v === 'contact',
                  userRole: v === 'volunteer' || v === 'contact' ? f.userRole : v as FeteUser['role'],
                }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="volunteer">Volunteer</SelectItem>
                  <SelectItem value="contact">Contact</SelectItem>
                  <SelectItem value="store keeper">Store Keeper</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {!form.isUser && (form.isVolunteer || form.isContact) && <div className="space-y-1"><Label>Email</Label><Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>}
            {form.isUser && <>
            <div className="space-y-1">
              <Label>Email</Label>
              <Input type="email" value={form.email ?? ''}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
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
            </>}
            {(form.isVolunteer || form.isContact) && <>
              <div className="space-y-1"><Label>Phone</Label><Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
            </>}
            {form.isVolunteer && <>
              <div className="space-y-2"><Label>Willing volunteer roles</Label><div className="grid grid-cols-2 gap-2">{VOLUNTEER_ROLES.map(role => <Label key={role} className="flex items-center gap-2 text-sm font-normal"><input type="checkbox" checked={form.volunteerRoles.includes(role)} onChange={event => setForm(person => ({ ...person, volunteerRoles: event.target.checked ? [...person.volunteerRoles, role] : person.volunteerRoles.filter(item => item !== role) }))} />{role}</Label>)}</div></div>
            </>}
            {(form.isVolunteer || form.isContact) && <>
              <div className="space-y-1"><Label>Notes</Label><Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div>
            </>}
            {form.isContact && <div className="space-y-2"><Label>Related events</Label><div className="grid grid-cols-2 gap-2">{fetes.map(fete => <Label key={fete.id} className="flex items-center gap-2 text-sm font-normal"><input type="checkbox" checked={form.contactEventIds.includes(fete.id)} onChange={event => setForm(person => ({ ...person, contactEventIds: event.target.checked ? [...person.contactEventIds, fete.id] : person.contactEventIds.filter(id => id !== fete.id) }))} />{fete.name}</Label>)}</div></div>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => void handleSave()} disabled={saving || savingVolunteer || savingContact || !form.name || (!form.isUser && !form.isVolunteer && !form.isContact) || (form.isUser && (!form.email || !form.pin)) || (form.isContact && form.contactEventIds.length === 0)}>
              {saving || savingVolunteer || savingContact ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
