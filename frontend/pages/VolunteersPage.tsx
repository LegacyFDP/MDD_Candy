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

const TIME_OPTIONS = [
  '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00',
]

type TimeSlot = {
  id: string
  start_time: string
  end_time: string
}

type DaySchedule = {
  enabled: boolean
  slots: TimeSlot[]
}

function addDays(date: string, days: number): string {
  const result = new Date(`${date}T12:00:00Z`)
  result.setUTCDate(result.getUTCDate() + days)
  return result.toISOString().slice(0, 10)
}

function getDatesInRange(start: string, end: string): string[] {
  if (!start) return []
  const endDate = end || start
  const dates: string[] = []
  let current = new Date(`${start}T12:00:00Z`)
  const last = new Date(`${endDate}T12:00:00Z`)
  while (current <= last && dates.length < 5) {
    dates.push(current.toISOString().slice(0, 10))
    current.setUTCDate(current.getUTCDate() + 1)
  }
  return dates.length > 0 ? dates : [start]
}

function formatFriendlyDate(dateStr: string): string {
  if (!dateStr) return ''
  const date = new Date(`${dateStr}T12:00:00Z`)
  return date.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

function toMinutes(value: string): number {
  return Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5))
}

let slotIdCounter = 1
function createSlotId(): string {
  return `slot-${Date.now()}-${slotIdCounter++}`
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
  const [allocationMode, setAllocationMode] = useState<'all' | 'individual'>('all')
  const [allDaysSlots, setAllDaysSlots] = useState<TimeSlot[]>([
    { id: '1', start_time: '09:00', end_time: '12:00' },
  ])
  const [individualDays, setIndividualDays] = useState<Record<string, DaySchedule>>({})

  const selectedFete = fetes.find(fete => fete.id === shiftForm.fete_id)
  const shiftDateMin = selectedFete ? addDays(selectedFete.event_date, -1) : undefined
  const shiftDateMax = selectedFete ? addDays(selectedFete.event_date, 1) : undefined
  const shiftDates = getDatesInRange(shiftForm.start_date, shiftForm.end_date || shiftForm.start_date)
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

  function handleDateChange(newStart: string, newEnd: string) {
    let start = newStart
    let end = newEnd || newStart
    if (end < start) end = start

    setShiftForm(f => ({ ...f, start_date: start, end_date: end }))
    const dates = getDatesInRange(start, end)
    setIndividualDays(prev => {
      const next: Record<string, DaySchedule> = {}
      for (const d of dates) {
        next[d] = prev[d] ?? {
          enabled: true,
          slots: allDaysSlots.length > 0
            ? allDaysSlots.map((s, idx) => ({ ...s, id: `${d}-${idx + 1}` }))
            : [{ id: createSlotId(), start_time: '09:00', end_time: '12:00' }],
        }
      }
      return next
    })
  }

  function addSlotToAllDays() {
    setAllDaysSlots(prev => [
      ...prev,
      { id: createSlotId(), start_time: '13:00', end_time: '17:00' },
    ])
  }

  function removeSlotFromAllDays(slotId: string) {
    setAllDaysSlots(prev => prev.length > 1 ? prev.filter(s => s.id !== slotId) : prev)
  }

  function updateAllDaysSlot(slotId: string, field: 'start_time' | 'end_time', value: string) {
    setAllDaysSlots(prev => prev.map(s => s.id === slotId ? { ...s, [field]: value } : s))
  }

  function applyPresetToAllDays(start: string, end: string) {
    setAllDaysSlots([{ id: createSlotId(), start_time: start, end_time: end }])
  }

  function toggleDayEnabled(date: string) {
    setIndividualDays(prev => ({
      ...prev,
      [date]: {
        enabled: !(prev[date]?.enabled ?? true),
        slots: prev[date]?.slots?.length ? prev[date].slots : [{ id: createSlotId(), start_time: '09:00', end_time: '12:00' }],
      },
    }))
  }

  function addSlotToDay(date: string) {
    setIndividualDays(prev => {
      const current = prev[date] ?? { enabled: true, slots: [] }
      return {
        ...prev,
        [date]: {
          ...current,
          enabled: true,
          slots: [
            ...current.slots,
            { id: createSlotId(), start_time: '13:00', end_time: '17:00' },
          ],
        },
      }
    })
  }

  function removeSlotFromDay(date: string, slotId: string) {
    setIndividualDays(prev => {
      const current = prev[date]
      if (!current || current.slots.length <= 1) return prev
      return {
        ...prev,
        [date]: {
          ...current,
          slots: current.slots.filter(s => s.id !== slotId),
        },
      }
    })
  }

  function updateDaySlot(date: string, slotId: string, field: 'start_time' | 'end_time', value: string) {
    setIndividualDays(prev => {
      const current = prev[date]
      if (!current) return prev
      return {
        ...prev,
        [date]: {
          ...current,
          slots: current.slots.map(s => s.id === slotId ? { ...s, [field]: value } : s),
        },
      }
    })
  }

  function applyPresetToDay(date: string, start: string, end: string) {
    setIndividualDays(prev => ({
      ...prev,
      [date]: {
        enabled: true,
        slots: [{ id: createSlotId(), start_time: start, end_time: end }],
      },
    }))
  }

  function copyDaySlotsToAllDays(fromDate: string) {
    const sourceSlots = individualDays[fromDate]?.slots ?? [{ id: createSlotId(), start_time: '09:00', end_time: '12:00' }]
    setIndividualDays(prev => {
      const next = { ...prev }
      for (const d of shiftDates) {
        if (d === fromDate) continue
        next[d] = {
          enabled: true,
          slots: sourceSlots.map(s => ({ ...s, id: createSlotId() })),
        }
      }
      return next
    })
  }

  function openNewShift(volunteerId = selectedVolunteerId, feteId = selectedFeteId) {
    const today = new Date().toISOString().slice(0, 10)
    const fete = fetes.find(item => item.id === feteId)
    const startDate = fete ? addDays(fete.event_date, -1) : today
    const endDate = fete ? addDays(fete.event_date, 1) : today
    const volId = volunteerId ?? volunteers[0]?.id ?? null
    const vol = volunteers.find(v => v.id === volId)

    setShiftForm({
      volunteer_id: volId,
      fete_id: feteId,
      roles: vol?.roles?.length ? [...vol.roles] : [],
      start_date: startDate,
      end_date: endDate,
      start_time: '09:00',
      end_time: '12:00',
    })
    setAllocationMode('all')
    const initialSlots = [{ id: createSlotId(), start_time: '09:00', end_time: '12:00' }]
    setAllDaysSlots(initialSlots)

    const dates = getDatesInRange(startDate, endDate)
    const initialDays: Record<string, DaySchedule> = {}
    for (const d of dates) {
      initialDays[d] = {
        enabled: true,
        slots: [{ id: createSlotId(), start_time: '09:00', end_time: '12:00' }],
      }
    }
    setIndividualDays(initialDays)
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
    setAllocationMode('all')
    setAllDaysSlots([
      { id: createSlotId(), start_time: shift.start_time, end_time: shift.end_time },
    ])
    setIndividualDays({
      [shift.start_date]: {
        enabled: true,
        slots: [{ id: createSlotId(), start_time: shift.start_time, end_time: shift.end_time }],
      },
    })
    setShiftEditId(shift.id)
    setShiftSaveError('')
    setShiftOpen(true)
  }

  async function handleSaveShift() {
    setShiftSaveError('')

    if (!shiftForm.volunteer_id) {
      setShiftSaveError('Volunteer is required')
      return
    }
    if (!shiftForm.start_date) {
      setShiftSaveError('Shift start date is required')
      return
    }

    try {
      if (shiftEditId) {
        const slot = allDaysSlots[0] ?? { start_time: shiftForm.start_time, end_time: shiftForm.end_time }
        if (toMinutes(slot.end_time) <= toMinutes(slot.start_time)) {
          setShiftSaveError('End time must be after start time')
          return
        }
        await saveVolunteerShift({
          id: shiftEditId,
          volunteer_id: shiftForm.volunteer_id,
          fete_id: shiftForm.fete_id ?? null,
          roles: shiftForm.roles,
          start_date: shiftForm.start_date,
          end_date: shiftForm.end_date || shiftForm.start_date,
          start_time: slot.start_time,
          end_time: slot.end_time,
        })
      } else {
        const shiftsToSave: Array<{
          start_date: string
          end_date: string
          start_time: string
          end_time: string
        }> = []

        const dates = shiftDates.length > 0 ? shiftDates : [shiftForm.start_date]

        if (dates.length === 1 || allocationMode === 'all') {
          if (allDaysSlots.length === 0) {
            setShiftSaveError('Please allocate at least one time slot')
            return
          }
          for (const slot of allDaysSlots) {
            if (toMinutes(slot.end_time) <= toMinutes(slot.start_time)) {
              setShiftSaveError(`End time (${slot.end_time}) must be after start time (${slot.start_time})`)
              return
            }
          }
          for (const d of dates) {
            for (const slot of allDaysSlots) {
              shiftsToSave.push({
                start_date: d,
                end_date: d,
                start_time: slot.start_time,
                end_time: slot.end_time,
              })
            }
          }
        } else {
          for (const d of dates) {
            const daySchedule = individualDays[d]
            if (daySchedule && daySchedule.enabled) {
              for (const slot of daySchedule.slots) {
                if (toMinutes(slot.end_time) <= toMinutes(slot.start_time)) {
                  setShiftSaveError(`End time (${slot.end_time}) must be after start time (${slot.start_time}) on ${formatFriendlyDate(d)}`)
                  return
                }
                shiftsToSave.push({
                  start_date: d,
                  end_date: d,
                  start_time: slot.start_time,
                  end_time: slot.end_time,
                })
              }
            }
          }
        }

        if (shiftsToSave.length === 0) {
          setShiftSaveError('Please allocate the volunteer to at least one time slot on individual or all days.')
          return
        }

        await saveVolunteerShift({
          volunteer_id: shiftForm.volunteer_id,
          fete_id: shiftForm.fete_id ?? null,
          roles: shiftForm.roles,
          shifts: shiftsToSave,
        })
      }

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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{shiftEditId ? 'Edit Shift' : 'Add Shift'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {shiftSaveError && <p role="alert" className="text-sm text-destructive">{shiftSaveError}</p>}
            <div className="space-y-1">
              <Label>Volunteer</Label>
              <Select
                value={String(shiftForm.volunteer_id ?? '')}
                onValueChange={value => {
                  const vId = Number(value)
                  const vol = volunteers.find(v => v.id === vId)
                  setShiftForm(f => ({
                    ...f,
                    volunteer_id: vId,
                    roles: f.roles.length > 0 ? f.roles : (vol?.roles ?? []),
                  }))
                }}
              >
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
              <Select
                value={shiftForm.fete_id == null ? 'none' : String(shiftForm.fete_id)}
                onValueChange={value => {
                  const feteId = value === 'none' ? null : Number(value)
                  const fete = fetes.find(item => item.id === feteId)
                  const minimumDate = fete ? addDays(fete.event_date, -1) : undefined
                  const maximumDate = fete ? addDays(fete.event_date, 1) : undefined
                  const newStart = minimumDate && (shiftForm.start_date < minimumDate || shiftForm.start_date > maximumDate)
                    ? minimumDate
                    : shiftForm.start_date
                  const newEnd = maximumDate && (shiftForm.end_date < minimumDate || shiftForm.end_date > maximumDate)
                    ? maximumDate
                    : shiftForm.end_date
                  setShiftForm(form => ({
                    ...form,
                    fete_id: feteId,
                  }))
                  handleDateChange(newStart, newEnd)
                }}
              >
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
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {VOLUNTEER_ROLES.map(role => (
                  <Label key={role} className="flex items-center gap-2 text-sm font-normal cursor-pointer">
                    <input
                      type="checkbox"
                      checked={shiftForm.roles.includes(role)}
                      onChange={event => setShiftForm(form => ({
                        ...form,
                        roles: event.target.checked
                          ? [...form.roles, role]
                          : form.roles.filter(item => item !== role),
                      }))}
                      className="rounded"
                    />
                    {role}
                  </Label>
                ))}
              </div>
            </div>

            <div className="space-y-2 border-t pt-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Shift Dates</Label>
                {selectedFete && (
                  <div className="flex items-center gap-1.5 text-xs">
                    <button
                      type="button"
                      className="text-primary hover:underline"
                      onClick={() => handleDateChange(selectedFete.event_date, selectedFete.event_date)}
                    >
                      Event Day Only
                    </button>
                    <span className="text-muted-foreground">·</span>
                    <button
                      type="button"
                      className="text-primary hover:underline"
                      onClick={() => handleDateChange(addDays(selectedFete.event_date, -1), addDays(selectedFete.event_date, 1))}
                    >
                      All 3 Event Days
                    </button>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Start date</Label>
                  <Input
                    type="date"
                    min={shiftDateMin}
                    max={shiftDateMax}
                    value={shiftForm.start_date}
                    onChange={e => handleDateChange(e.target.value, shiftForm.end_date || e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">End date</Label>
                  <Input
                    type="date"
                    min={shiftDateMin}
                    max={shiftDateMax}
                    value={shiftForm.end_date || shiftForm.start_date}
                    onChange={e => handleDateChange(shiftForm.start_date, e.target.value)}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <p>
                  {selectedFete
                    ? 'Schedule is limited to 1 day before through 1 day after the event.'
                    : 'Schedule can span 1 to 3 consecutive days.'}
                </p>
                <span className="font-medium text-foreground whitespace-nowrap">
                  {shiftDates.length} {shiftDates.length === 1 ? 'day' : 'days'} selected
                </span>
              </div>
            </div>

            {/* Time Slot Allocation Mode (when multiple days and not single-edit) */}
            {shiftDates.length > 1 && !shiftEditId && (
              <div className="space-y-1.5 border-t pt-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold">Time Slot Allocation</Label>
                  <span className="text-xs text-muted-foreground">Allocate to individual or all days</span>
                </div>
                <div className="grid grid-cols-2 gap-2 p-1 bg-muted rounded-lg">
                  <button
                    type="button"
                    onClick={() => setAllocationMode('all')}
                    className={`py-1.5 px-3 text-xs font-medium rounded-md transition-all ${
                      allocationMode === 'all'
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    All Days (Same time slots)
                  </button>
                  <button
                    type="button"
                    onClick={() => setAllocationMode('individual')}
                    className={`py-1.5 px-3 text-xs font-medium rounded-md transition-all ${
                      allocationMode === 'individual'
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Individual Days (Custom time slots)
                  </button>
                </div>
              </div>
            )}

            {/* Time Slots: All Days (or Single Day, or Single Edit) */}
            {(shiftDates.length === 1 || shiftEditId || allocationMode === 'all') && (
              <div className="space-y-3 border rounded-lg p-3 bg-muted/20">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold">
                    {shiftDates.length > 1 && !shiftEditId
                      ? `Time Slots (Applied across all ${shiftDates.length} days)`
                      : `Time Slots (${formatFriendlyDate(shiftForm.start_date)})`}
                  </Label>
                  <span className="text-xs text-muted-foreground">09:00 to 18:00 (1hr blocks)</span>
                </div>

                <div className="space-y-2">
                  {allDaysSlots.map((slot, idx) => (
                    <div key={slot.id} className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-12 shrink-0">Slot {idx + 1}:</span>
                      <Select
                        value={slot.start_time}
                        onValueChange={val => updateAllDaysSlot(slot.id, 'start_time', val)}
                      >
                        <SelectTrigger className="h-8 w-28 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {TIME_OPTIONS.slice(0, -1).map(t => (
                            <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <span className="text-xs text-muted-foreground">to</span>
                      <Select
                        value={slot.end_time}
                        onValueChange={val => updateAllDaysSlot(slot.id, 'end_time', val)}
                      >
                        <SelectTrigger className="h-8 w-28 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {TIME_OPTIONS.slice(1).map(t => (
                            <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {allDaysSlots.length > 1 && !shiftEditId && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => removeSlotFromAllDays(slot.id)}
                          aria-label="Remove time slot"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>

                {!shiftEditId && (
                  <div className="flex items-center justify-between gap-2 pt-1 flex-wrap">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={addSlotToAllDays}
                    >
                      <Plus className="w-3 h-3 mr-1" /> Add Time Slot
                    </Button>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span>Presets:</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 px-1.5 text-xs"
                        onClick={() => applyPresetToAllDays('09:00', '13:00')}
                      >
                        09:00–13:00
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 px-1.5 text-xs"
                        onClick={() => applyPresetToAllDays('13:00', '17:00')}
                      >
                        13:00–17:00
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 px-1.5 text-xs"
                        onClick={() => applyPresetToAllDays('09:00', '18:00')}
                      >
                        All Day
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Time Slots: Individual Days */}
            {shiftDates.length > 1 && !shiftEditId && allocationMode === 'individual' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold">Time Slots by Day</Label>
                  <span className="text-xs text-muted-foreground">Allocate volunteer to at least one time slot</span>
                </div>

                {shiftDates.map(d => {
                  const dayData = individualDays[d] ?? {
                    enabled: true,
                    slots: [{ id: createSlotId(), start_time: '09:00', end_time: '12:00' }],
                  }
                  return (
                    <div
                      key={d}
                      className={`border rounded-lg p-3 transition-colors ${
                        dayData.enabled ? 'bg-card border-border' : 'bg-muted/40 border-dashed opacity-70'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <label className="flex items-center gap-2 cursor-pointer font-medium text-sm">
                          <input
                            type="checkbox"
                            checked={dayData.enabled}
                            onChange={() => toggleDayEnabled(d)}
                            className="rounded h-4 w-4 text-primary"
                          />
                          <span>{formatFriendlyDate(d)}</span>
                        </label>
                        {dayData.enabled && shiftDates.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-6 text-xs text-muted-foreground hover:text-foreground"
                            onClick={() => copyDaySlotsToAllDays(d)}
                          >
                            Copy slots to other days
                          </Button>
                        )}
                      </div>

                      {dayData.enabled ? (
                        <div className="space-y-2 pl-6">
                          {dayData.slots.map((slot, sIdx) => (
                            <div key={slot.id} className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground w-12 shrink-0">Slot {sIdx + 1}:</span>
                              <Select
                                value={slot.start_time}
                                onValueChange={val => updateDaySlot(d, slot.id, 'start_time', val)}
                              >
                                <SelectTrigger className="h-8 w-28 text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {TIME_OPTIONS.slice(0, -1).map(t => (
                                    <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <span className="text-xs text-muted-foreground">to</span>
                              <Select
                                value={slot.end_time}
                                onValueChange={val => updateDaySlot(d, slot.id, 'end_time', val)}
                              >
                                <SelectTrigger className="h-8 w-28 text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {TIME_OPTIONS.slice(1).map(t => (
                                    <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {dayData.slots.length > 1 && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive hover:text-destructive"
                                  onClick={() => removeSlotFromDay(d, slot.id)}
                                  aria-label="Remove time slot"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              )}
                            </div>
                          ))}
                          <div className="flex items-center justify-between gap-2 pt-1 flex-wrap">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => addSlotToDay(d)}
                            >
                              <Plus className="w-3 h-3 mr-1" /> Add Time Slot
                            </Button>
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <span>Presets:</span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-6 px-1.5 text-xs"
                                onClick={() => applyPresetToDay(d, '09:00', '13:00')}
                              >
                                09:00–13:00
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-6 px-1.5 text-xs"
                                onClick={() => applyPresetToDay(d, '13:00', '17:00')}
                              >
                                13:00–17:00
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-6 px-1.5 text-xs"
                                onClick={() => applyPresetToDay(d, '09:00', '18:00')}
                              >
                                All Day
                              </Button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground pl-6">Volunteer is not allocated on this day.</p>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
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
