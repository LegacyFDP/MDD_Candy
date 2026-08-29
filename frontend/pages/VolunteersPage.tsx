import { useEffect, useState } from 'react'
import {
  useGetVolunteers,
  useSaveVolunteer,
  useDeleteVolunteer,
  useGetVolunteerShifts,
  useSaveVolunteerShift,
  useDeleteVolunteerShift,
  useGetFetes,
} from '../hooks/backend/fete'
import { Button } from '../lib/shadcn/button'
import { Input } from '../lib/shadcn/input'
import { Label } from '../lib/shadcn/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../lib/shadcn/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../lib/shadcn/select'
import { Plus, Pencil, Trash2, Users, CalendarRange } from 'lucide-react'
import type { AppUser } from './Login'

interface Props { currentUser: AppUser }

type Volunteer = {
  id: number
  name: string
  email: string
  phone: string
  role: string
  notes: string
}

type VolunteerShift = {
  id: number
  volunteer_id: number
  volunteer_name: string
  fete_id: number | null
  fete_name: string | null
  role: string
  start_date: string
  end_date: string
  start_time: string
  end_time: string
}

type Fete = {
  id: number
  name: string
  event_date: string
}

const VOLUNTEER_ROLES = ['Lead Volunteer', 'Helper', 'Putting Up', 'Taking Down', 'Transport', 'Stall Holder']

export default function VolunteersPage({ currentUser }: Props) {
  const { data: volunteersRaw, trigger: loadVolunteers } = useGetVolunteers()
  const { data: shiftsRaw, trigger: loadShifts } = useGetVolunteerShifts()
  const { data: fetesRaw, trigger: loadFetes } = useGetFetes()
  const { trigger: saveVolunteer, loading: savingVolunteer } = useSaveVolunteer()
  const { trigger: deleteVolunteer } = useDeleteVolunteer()
  const { trigger: saveVolunteerShift, loading: savingShift } = useSaveVolunteerShift()
  const { trigger: deleteVolunteerShift } = useDeleteVolunteerShift()

  const volunteers = (volunteersRaw ?? []) as Volunteer[]
  const shifts = (shiftsRaw ?? []) as VolunteerShift[]
  const fetes = (fetesRaw ?? []) as Fete[]

  const [open, setOpen] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [shiftOpen, setShiftOpen] = useState(false)
  const [shiftEditId, setShiftEditId] = useState<number | null>(null)
  const [form, setForm] = useState<Partial<Volunteer>>({
    name: '', email: '', phone: '', role: 'Helper', notes: ''
  })
  const [shiftForm, setShiftForm] = useState<{
    volunteer_id: number | null
    fete_id: number | null
    role: string
    start_date: string
    end_date: string
    start_time: string
    end_time: string
  }>({
    volunteer_id: null,
    fete_id: null,
    role: 'Helper',
    start_date: '',
    end_date: '',
    start_time: '09:00',
    end_time: '12:00',
  })

  useEffect(() => {
    void loadVolunteers({})
    void loadShifts({})
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
    setForm({ name: '', email: '', phone: '', role: 'Helper', notes: '' })
    setEditId(null)
    setOpen(true)
  }

  function openEdit(v: Volunteer) {
    setForm({ ...v })
    setEditId(v.id)
    setOpen(true)
  }

  function openNewShift() {
    setShiftForm({
      volunteer_id: volunteers[0]?.id ?? null,
      fete_id: null,
      role: 'Helper',
      start_date: '',
      end_date: '',
      start_time: '09:00',
      end_time: '12:00',
    })
    setShiftEditId(null)
    setShiftOpen(true)
  }

  function openEditShift(shift: VolunteerShift) {
    setShiftForm({
      volunteer_id: shift.volunteer_id,
      fete_id: shift.fete_id,
      role: shift.role,
      start_date: shift.start_date,
      end_date: shift.end_date,
      start_time: shift.start_time,
      end_time: shift.end_time,
    })
    setShiftEditId(shift.id)
    setShiftOpen(true)
  }

  async function handleSave() {
    await saveVolunteer({
      ...(editId ? { id: editId } : {}),
      name: form.name ?? '',
      email: form.email ?? '',
      phone: form.phone ?? '',
      role: form.role ?? 'Helper',
      notes: form.notes ?? '',
    })
    setOpen(false)
    void loadVolunteers({})
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this volunteer?')) return
    await deleteVolunteer({ id })
    void loadVolunteers({})
    void loadShifts({})
  }

  async function handleSaveShift() {
    await saveVolunteerShift({
      ...(shiftEditId ? { id: shiftEditId } : {}),
      volunteer_id: shiftForm.volunteer_id ?? 0,
      fete_id: shiftForm.fete_id ?? null,
      role: shiftForm.role,
      start_date: shiftForm.start_date,
      end_date: shiftForm.end_date || shiftForm.start_date,
      start_time: shiftForm.start_time,
      end_time: shiftForm.end_time,
    })
    setShiftOpen(false)
    void loadShifts({})
  }

  async function handleDeleteShift(id: number) {
    if (!confirm('Delete this shift?')) return
    await deleteVolunteerShift({ id })
    void loadShifts({})
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Volunteer Management</h1>
          <p className="text-muted-foreground text-sm">Track volunteers, roles, events and shift coverage</p>
        </div>
        <Button onClick={openNew} className="flex items-center gap-2">
          <Plus className="w-4 h-4" /> Add Volunteer
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {volunteers.map(v => (
          <div key={v.id} className="border rounded-lg p-4 bg-card text-card-foreground flex items-start gap-3">
            <div className="bg-primary/10 p-2 rounded-full flex-shrink-0">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium">{v.name}</p>
              <p className="text-sm text-muted-foreground">{v.role}</p>
              {v.email && <p className="text-xs text-muted-foreground mt-1">{v.email}</p>}
              {v.phone && <p className="text-xs text-muted-foreground">{v.phone}</p>}
              {v.notes && <p className="text-xs text-muted-foreground mt-1">{v.notes}</p>}
            </div>
            <div className="flex flex-col gap-2">
              <Button size="sm" variant="outline" onClick={() => openEdit(v)} aria-label="Edit volunteer">
                <Pencil className="w-3 h-3" />
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleDelete(v.id)} aria-label="Delete volunteer">
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <div className="border rounded-lg bg-card p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarRange className="w-4 h-4 text-primary" />
            <h2 className="text-lg font-semibold">Shift rota</h2>
          </div>
          <Button onClick={openNewShift} className="flex items-center gap-2">
            <Plus className="w-4 h-4" /> Add Shift
          </Button>
        </div>

        {shifts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No volunteer shifts yet.</p>
        ) : (
          <div className="space-y-2">
            {shifts.map(shift => (
              <div key={shift.id} className="flex items-center justify-between border rounded-md p-3 gap-3">
                <div>
                  <p className="font-medium">{shift.volunteer_name}</p>
                  <p className="text-sm text-muted-foreground">
                    {shift.role} · {shift.start_date}{shift.start_date !== shift.end_date ? ` to ${shift.end_date}` : ''} · {shift.start_time}–{shift.end_time}
                  </p>
                  {shift.fete_name && <p className="text-xs text-muted-foreground">Event: {shift.fete_name}</p>}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => openEditShift(shift)}>
                    <Pencil className="w-3 h-3" />
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleDeleteShift(shift.id)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editId ? 'Edit Volunteer' : 'Add Volunteer'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Name</Label>
              <Input value={form.name ?? ''} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Email</Label>
              <Input type="email" value={form.email ?? ''} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Phone</Label>
              <Input value={form.phone ?? ''} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Role</Label>
              <Select value={form.role ?? 'Helper'} onValueChange={value => setForm(f => ({ ...f, role: value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {VOLUNTEER_ROLES.map(role => (
                    <SelectItem key={role} value={role}>{role}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Notes</Label>
              <Input value={form.notes ?? ''} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={savingVolunteer || !form.name}>
              {savingVolunteer ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={shiftOpen} onOpenChange={setShiftOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{shiftEditId ? 'Edit Shift' : 'Add Shift'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Volunteer</Label>
              <Select value={String(shiftForm.volunteer_id ?? '')} onValueChange={value => setShiftForm(f => ({ ...f, volunteer_id: Number(value) }))}>
                <SelectTrigger><SelectValue placeholder="Select volunteer" /></SelectTrigger>
                <SelectContent>
                  {volunteers.map(vol => (
                    <SelectItem key={vol.id} value={String(vol.id)}>{vol.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Event</Label>
              <Select value={shiftForm.fete_id == null ? 'none' : String(shiftForm.fete_id)} onValueChange={value => setShiftForm(f => ({ ...f, fete_id: value === 'none' ? null : Number(value) }))}>
                <SelectTrigger><SelectValue placeholder="Optional event" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No event assigned</SelectItem>
                  {fetes.map(fete => (
                    <SelectItem key={fete.id} value={String(fete.id)}>{fete.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Role</Label>
              <Select value={shiftForm.role} onValueChange={value => setShiftForm(f => ({ ...f, role: value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {VOLUNTEER_ROLES.map(role => (
                    <SelectItem key={role} value={role}>{role}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Start date</Label>
                <Input type="date" value={shiftForm.start_date} onChange={e => setShiftForm(f => ({ ...f, start_date: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>End date</Label>
                <Input type="date" value={shiftForm.end_date || shiftForm.start_date} onChange={e => setShiftForm(f => ({ ...f, end_date: e.target.value }))} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Schedule can run for 1–3 consecutive days, with hourly blocks from 09:00 to 18:00.</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Start time</Label>
                <Input type="time" step="3600" min="09:00" max="18:00" value={shiftForm.start_time} onChange={e => setShiftForm(f => ({ ...f, start_time: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>End time</Label>
                <Input type="time" step="3600" min="09:00" max="18:00" value={shiftForm.end_time} onChange={e => setShiftForm(f => ({ ...f, end_time: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShiftOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveShift} disabled={savingShift || !shiftForm.volunteer_id || !shiftForm.start_date}>
              {savingShift ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
