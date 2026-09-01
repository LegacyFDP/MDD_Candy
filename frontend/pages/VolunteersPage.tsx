import { useEffect, useState } from 'react'
import {
  useGetVolunteers,
  useGetVolunteerShifts,
  useSaveVolunteerShift,
  useDeleteVolunteerShift,
  useGetFetes,
  useSaveFete,
  useDeleteFete,
} from '../hooks/backend/fete'
import { Button } from '../lib/shadcn/button'
import { Input } from '../lib/shadcn/input'
import { Label } from '../lib/shadcn/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../lib/shadcn/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../lib/shadcn/select'
import { Plus, Trash2, Pencil, Users, CalendarRange } from 'lucide-react'
import type { AppUser } from './Login'

interface Props { currentUser: AppUser }

type Volunteer = {
  id: number
  name: string
  email: string
  phone: string
  roles: string[]
  notes: string
}

type VolunteerShift = {
  id: number
  volunteer_id: number
  volunteer_name: string
  fete_id: number | null
  fete_name: string | null
  roles: string[]
  start_date: string
  end_date: string
  start_time: string
  end_time: string
}

type Fete = {
  id: number
  name: string
  event_date: string
  description: string
  notes: string
  status: string
  location_id: number | null
}

const VOLUNTEER_ROLES = ['Lead Volunteer', 'Helper', 'Putting Up', 'Taking Down', 'Transport', 'Stall Holder']

function addDays(date: string, days: number): string {
  const result = new Date(`${date}T12:00:00Z`)
  result.setUTCDate(result.getUTCDate() + days)
  return result.toISOString().slice(0, 10)
}

export default function VolunteersPage({ currentUser }: Props) {
  const { data: volunteersRaw, trigger: loadVolunteers } = useGetVolunteers()
  const { data: shiftsRaw, trigger: loadShifts } = useGetVolunteerShifts()
  const { data: fetesRaw, trigger: loadFetes } = useGetFetes()
  const { trigger: saveVolunteerShift, loading: savingShift } = useSaveVolunteerShift()
  const { trigger: deleteVolunteerShift } = useDeleteVolunteerShift()
  const { trigger: saveFete, loading: savingFete } = useSaveFete()
  const { trigger: deleteFete } = useDeleteFete()

  const volunteers = (volunteersRaw ?? []) as Volunteer[]
  const shifts = (shiftsRaw ?? []) as VolunteerShift[]
  const fetes = (fetesRaw ?? []) as Fete[]

  const [shiftOpen, setShiftOpen] = useState(false)
  const [shiftEditId, setShiftEditId] = useState<number | null>(null)
  const [shiftSaveError, setShiftSaveError] = useState('')
  const [selectedVolunteerId, setSelectedVolunteerId] = useState<number | null>(null)
  const [selectedFeteId, setSelectedFeteId] = useState<number | null>(null)
  const [volunteersForEventId, setVolunteersForEventId] = useState<number | null>(null)
  const [eventsForVolunteerId, setEventsForVolunteerId] = useState<number | null>(null)
  const [feteOpen, setFeteOpen] = useState(false)
  const [feteForm, setFeteForm] = useState<Partial<Fete>>({})
  const [shiftForm, setShiftForm] = useState<{
    volunteer_id: number | null
    fete_id: number | null
    roles: string[]
    start_date: string
    end_date: string
    start_time: string
    end_time: string
  }>({
    volunteer_id: null,
    fete_id: null,
    roles: [],
    start_date: '',
    end_date: '',
    start_time: '09:00',
    end_time: '12:00',
  })
  const selectedFete = fetes.find(fete => fete.id === shiftForm.fete_id)
  const shiftDateMin = selectedFete ? addDays(selectedFete.event_date, -1) : undefined
  const shiftDateMax = selectedFete ? addDays(selectedFete.event_date, 1) : undefined
  const volunteersForEvent = fetes.find(fete => fete.id === volunteersForEventId)
  const eventVolunteerShifts = shifts.filter(shift => shift.fete_id === volunteersForEventId)
  const eventsForVolunteer = volunteers.find(volunteer => volunteer.id === eventsForVolunteerId)
  const volunteerEventShifts = shifts.filter(shift => shift.volunteer_id === eventsForVolunteerId && shift.fete_id != null)

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

  function openNewShift(volunteerId = selectedVolunteerId, feteId = selectedFeteId) {
    const today = new Date().toISOString().slice(0, 10)
    const fete = fetes.find(item => item.id === feteId)
    const startDate = fete ? addDays(fete.event_date, -1) : today
    const endDate = fete ? addDays(fete.event_date, 1) : today
    setShiftForm({
      volunteer_id: volunteerId ?? volunteers[0]?.id ?? null,
      fete_id: feteId,
      roles: [],
      start_date: startDate,
      end_date: endDate,
      start_time: '09:00',
      end_time: '12:00',
    })
    setShiftEditId(null)
    setShiftSaveError('')
    setShiftOpen(true)
  }

  function openEditShift(shift: VolunteerShift) {
    setShiftForm({
      volunteer_id: shift.volunteer_id,
      fete_id: shift.fete_id,
      roles: shift.roles,
      start_date: shift.start_date,
      end_date: shift.end_date,
      start_time: shift.start_time,
      end_time: shift.end_time,
    })
    setShiftEditId(shift.id)
    setShiftSaveError('')
    setShiftOpen(true)
  }

  async function handleSaveShift() {
    setShiftSaveError('')
    try {
      await saveVolunteerShift({
        ...(shiftEditId ? { id: shiftEditId } : {}),
        volunteer_id: shiftForm.volunteer_id ?? 0,
        fete_id: shiftForm.fete_id ?? null,
        roles: shiftForm.roles,
        start_date: shiftForm.start_date,
        end_date: shiftForm.end_date || shiftForm.start_date,
        start_time: shiftForm.start_time,
        end_time: shiftForm.end_time,
      })
      setShiftOpen(false)
      void loadShifts({})
    } catch (error) {
      setShiftSaveError(error instanceof Error ? error.message : 'Unable to save shift.')
    }
  }

  async function handleDeleteShift(id: number) {
    if (!confirm('Delete this shift?')) return
    await deleteVolunteerShift({ id })
    void loadShifts({})
  }

  function openEditFete(fete: Fete) {
    setFeteForm({ ...fete, event_date: fete.event_date.split('T')[0] ?? fete.event_date })
    setFeteOpen(true)
  }

  async function handleSaveFete() {
    await saveFete({
      id: feteForm.id,
      name: feteForm.name ?? '',
      event_date: feteForm.event_date ?? '',
      description: feteForm.description ?? '',
      notes: feteForm.notes ?? '',
      status: feteForm.status ?? 'planned',
      created_by: currentUser.id,
      location_id: feteForm.location_id ?? null,
    })
    setFeteOpen(false)
    void loadFetes({})
  }

  async function handleDeleteFete(fete: Fete) {
    if (!confirm(`Delete “${fete.name}”? This will remove its rota, contact links, and requirements.`)) return
    await deleteFete({ id: fete.id })
    setSelectedFeteId(null)
    setVolunteersForEventId(null)
    void loadFetes({})
    void loadShifts({})
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Volunteer Rota</h1>
          <p className="text-muted-foreground text-sm">Assign volunteers to events and manage shift coverage</p>
        </div>
      </div>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Volunteers</h2>
        <div className="h-[10.25rem] overflow-auto border rounded-lg bg-card">
          <table className="w-full text-sm">
          <thead className="sticky top-0 bg-muted text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Volunteer</th>
              <th className="px-3 py-2 font-medium">Willing roles</th>
              <th className="hidden md:table-cell px-3 py-2 font-medium">Email</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {volunteers.map(v => (
              <tr
                key={v.id}
                tabIndex={0}
                role="button"
                aria-pressed={selectedVolunteerId === v.id}
                onClick={() => {
                  setSelectedFeteId(null)
                  setSelectedVolunteerId(v.id)
                  setEventsForVolunteerId(v.id)
                }}
                onKeyDown={event => {
                  if (event.key !== 'Enter' && event.key !== ' ') return
                  event.preventDefault()
                  setSelectedFeteId(null)
                  setSelectedVolunteerId(v.id)
                  setEventsForVolunteerId(v.id)
                }}
                className={`cursor-pointer transition-colors focus:outline-none ${selectedVolunteerId === v.id ? 'bg-primary text-primary-foreground' : 'hover:bg-muted focus:bg-muted'}`}
              >
                <td className="h-11 px-3 py-2 font-medium">{v.name}</td>
                <td className="h-11 px-3 py-2">{v.roles.join(', ') || 'None'}</td>
                <td className="hidden md:table-cell h-11 px-3 py-2 truncate max-w-64">{v.email || v.phone || '-'}</td>
              </tr>
            ))}
          </tbody>
          </table>
        </div>
      </section>

      <div className="border rounded-lg bg-card p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarRange className="w-4 h-4 text-primary" />
            <h2 className="text-lg font-semibold">Event Shift Rota Management</h2>
          </div>
          <Button onClick={openNewShift} className="flex items-center gap-2">
            <Plus className="w-4 h-4" /> Add Shift
          </Button>
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Events</h3>
          <div className="h-56 overflow-y-auto border rounded-md divide-y">
            {fetes.map(fete => {
              const assignedVolunteers = new Set(shifts.filter(shift => shift.fete_id === fete.id).map(shift => shift.volunteer_id)).size
              return (
                <div key={fete.id} className={`flex items-center gap-1 px-1 ${selectedFeteId === fete.id ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedVolunteerId(null)
                      setSelectedFeteId(id => id === fete.id ? null : fete.id)
                      setVolunteersForEventId(fete.id)
                    }}
                    aria-pressed={selectedFeteId === fete.id}
                    className="flex-1 min-w-0 flex items-center justify-between gap-3 px-2 py-2 text-left text-sm"
                  >
                    <span className="min-w-0"><span className="block font-medium truncate">{fete.name}</span><span className="block text-xs opacity-75">{fete.event_date}</span></span>
                    <span className="text-xs whitespace-nowrap">{assignedVolunteers} volunteer{assignedVolunteers === 1 ? '' : 's'}</span>
                  </button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => openEditFete(fete)} aria-label={`Edit ${fete.name}`}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0 text-destructive hover:text-destructive" onClick={() => void handleDeleteFete(fete)} aria-label={`Delete ${fete.name}`}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              )
            })}
          </div>
        </div>

      </div>

      <Dialog open={feteOpen} onOpenChange={setFeteOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Event</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>Name</Label><Input value={feteForm.name ?? ''} onChange={event => setFeteForm(form => ({ ...form, name: event.target.value }))} /></div>
            <div className="space-y-1"><Label>Date</Label><Input type="date" value={feteForm.event_date ?? ''} onChange={event => setFeteForm(form => ({ ...form, event_date: event.target.value }))} /></div>
            <div className="space-y-1"><Label>Description</Label><Input value={feteForm.description ?? ''} onChange={event => setFeteForm(form => ({ ...form, description: event.target.value }))} /></div>
            <div className="space-y-1"><Label>Status</Label><Select value={feteForm.status ?? 'planned'} onValueChange={status => setFeteForm(form => ({ ...form, status }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="planned">Planned</SelectItem><SelectItem value="active">Active</SelectItem><SelectItem value="completed">Completed</SelectItem></SelectContent></Select></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setFeteOpen(false)}>Cancel</Button><Button onClick={() => void handleSaveFete()} disabled={savingFete || !feteForm.name || !feteForm.event_date}>{savingFete ? 'Saving…' : 'Save'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={volunteersForEventId != null} onOpenChange={isOpen => {
        if (!isOpen) setVolunteersForEventId(null)
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{volunteersForEvent?.name ?? 'Event'} volunteers</DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-auto border rounded-md">
            {eventVolunteerShifts.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">No volunteers are assigned to this event.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Volunteer</th>
                    <th className="px-3 py-2 font-medium">Role</th>
                    <th className="px-3 py-2 font-medium">Dates</th>
                    <th className="px-3 py-2 font-medium">Hours</th>
                    <th className="w-12 px-3 py-2"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {eventVolunteerShifts.map(shift => (
                    <tr
                      key={shift.id}
                      tabIndex={0}
                      role="button"
                      onClick={() => {
                        setVolunteersForEventId(null)
                        openEditShift(shift)
                      }}
                      onKeyDown={event => {
                        if (event.key !== 'Enter' && event.key !== ' ') return
                        event.preventDefault()
                        setVolunteersForEventId(null)
                        openEditShift(shift)
                      }}
                      className="cursor-pointer hover:bg-muted focus:bg-muted focus:outline-none"
                    >
                      <td className="px-3 py-2 font-medium">{shift.volunteer_name}</td>
                      <td className="px-3 py-2">{shift.roles.join(', ') || 'None'}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{shift.start_date}{shift.start_date !== shift.end_date ? ` to ${shift.end_date}` : ''}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{shift.start_time}-{shift.end_time}</td>
                      <td className="px-3 py-1.5">
                        <Button size="sm" variant="outline" onClick={event => { event.stopPropagation(); handleDeleteShift(shift.id) }} aria-label="Delete volunteer shift">
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={eventsForVolunteerId != null} onOpenChange={isOpen => {
        if (!isOpen) setEventsForVolunteerId(null)
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{eventsForVolunteer?.name ?? 'Volunteer'} events</DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-auto border rounded-md">
            {volunteerEventShifts.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">This volunteer is not assigned to any events.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Event</th>
                    <th className="px-3 py-2 font-medium">Role</th>
                    <th className="px-3 py-2 font-medium">Dates</th>
                    <th className="px-3 py-2 font-medium">Hours</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {volunteerEventShifts.map(shift => (
                    <tr
                      key={shift.id}
                      tabIndex={0}
                      role="button"
                      onClick={() => {
                        setSelectedVolunteerId(shift.volunteer_id)
                        setSelectedFeteId(shift.fete_id)
                        setEventsForVolunteerId(null)
                        openNewShift(shift.volunteer_id, shift.fete_id)
                      }}
                      onKeyDown={event => {
                        if (event.key !== 'Enter' && event.key !== ' ') return
                        event.preventDefault()
                        setSelectedVolunteerId(shift.volunteer_id)
                        setSelectedFeteId(shift.fete_id)
                        setEventsForVolunteerId(null)
                        openNewShift(shift.volunteer_id, shift.fete_id)
                      }}
                      className="cursor-pointer hover:bg-muted focus:bg-muted focus:outline-none"
                    >
                      <td className="px-3 py-2 font-medium">{shift.fete_name ?? 'Unassigned event'}</td>
                      <td className="px-3 py-2">{shift.roles.join(', ') || 'None'}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{shift.start_date}{shift.start_date !== shift.end_date ? ` to ${shift.end_date}` : ''}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{shift.start_time}-{shift.end_time}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={shiftOpen} onOpenChange={(isOpen) => {
        setShiftOpen(isOpen)
        if (!isOpen) setShiftSaveError('')
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{shiftEditId ? 'Edit Shift' : 'Add Shift'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {shiftSaveError && <p role="alert" className="text-sm text-destructive">{shiftSaveError}</p>}
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
              <Select value={shiftForm.fete_id == null ? 'none' : String(shiftForm.fete_id)} onValueChange={value => {
                const feteId = value === 'none' ? null : Number(value)
                const fete = fetes.find(item => item.id === feteId)
                const minimumDate = fete ? addDays(fete.event_date, -1) : undefined
                const maximumDate = fete ? addDays(fete.event_date, 1) : undefined
                setShiftForm(form => ({
                  ...form,
                  fete_id: feteId,
                  start_date: minimumDate && (form.start_date < minimumDate || form.start_date > maximumDate) ? minimumDate : form.start_date,
                  end_date: maximumDate && (form.end_date < minimumDate || form.end_date > maximumDate) ? maximumDate : form.end_date,
                }))
              }}>
                <SelectTrigger><SelectValue placeholder="Optional event" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No event assigned</SelectItem>
                  {fetes.map(fete => (
                    <SelectItem key={fete.id} value={String(fete.id)}>{fete.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Event roles</Label>
              <div className="grid grid-cols-2 gap-2">
                {VOLUNTEER_ROLES.map(role => (
                  <Label key={role} className="flex items-center gap-2 text-sm font-normal">
                    <input type="checkbox" checked={shiftForm.roles.includes(role)} onChange={event => setShiftForm(form => ({ ...form, roles: event.target.checked ? [...form.roles, role] : form.roles.filter(item => item !== role) }))} />
                    {role}
                  </Label>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Start date</Label>
                <Input type="date" min={shiftDateMin} max={shiftDateMax} value={shiftForm.start_date} onChange={e => setShiftForm(f => ({ ...f, start_date: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>End date</Label>
                <Input type="date" min={shiftDateMin} max={shiftDateMax} value={shiftForm.end_date || shiftForm.start_date} onChange={e => setShiftForm(f => ({ ...f, end_date: e.target.value }))} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">{selectedFete ? 'Schedule is limited to the day before through the day after this event.' : 'Schedule can run for 1–3 consecutive days.'} Hourly blocks run from 09:00 to 18:00.</p>
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
