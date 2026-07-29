import { useState } from 'react'
import { useSaveFeteVolunteer, useDeleteFeteVolunteer } from '../../hooks/backend/fete'
import { Button } from '../../lib/shadcn/button'
import { Input } from '../../lib/shadcn/input'
import { Label } from '../../lib/shadcn/label'
import { Badge } from '../../lib/shadcn/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '../../lib/shadcn/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '../../lib/shadcn/select'
import { Plus, Pencil, Trash2, UserCheck, Shield, User } from 'lucide-react'
import type { AppUser } from '../Login'

type AvailabilitySlot = {
  date: string
  start_hour: number
  end_hour: number
}

export type Volunteer = {
  id: number
  fete_id: number
  volunteer_id: number
  user_id?: number
  user_name: string
  email: string
  user_role: string
  role_key: string
  role_other: string
  role: string
  notes: string
  added_at: string
  availability: AvailabilitySlot[]
}

export type VolunteerPerson = { id: number; name: string; email: string }

interface Props {
  feteId: number
  volunteers: Volunteer[]
  allVolunteers: VolunteerPerson[]
  currentUser: AppUser
  onRefresh: () => void
}

const ROLE_OPTIONS = [
  'Lead Volunteer',
  'Helper',
  'Putting Up',
  'Taking Down',
  'Transport',
  'Stall Holder',
  'Other',
]

const HOUR_BLOCKS = Array.from({ length: 9 }, (_, idx) => 9 + idx)

function isConsecutive(days: string[]): boolean {
  if (days.length <= 1) return true
  const sorted = [...days].sort()
  for (let i = 1; i < sorted.length; i += 1) {
    const prev = new Date(`${sorted[i - 1]}T00:00:00Z`).getTime()
    const curr = new Date(`${sorted[i]}T00:00:00Z`).getTime()
    if ((curr - prev) / 86400000 !== 1) {
      return false
    }
  }
  return true
}

function formatHour(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00-${String(hour + 1).padStart(2, '0')}:00`
}

function slotSummary(slots: AvailabilitySlot[]): string {
  if (slots.length === 0) return ''
  const days = Array.from(new Set(slots.map((slot) => slot.date))).sort()
  return `${slots.length} slot${slots.length === 1 ? '' : 's'} across ${days.length} day${days.length === 1 ? '' : 's'}`
}

export default function FeteVolunteers({ feteId, volunteers, allVolunteers, currentUser, onRefresh }: Props) {
  const { trigger: saveVolunteer, loading: saving } = useSaveFeteVolunteer()
  const { trigger: deleteVolunteer } = useDeleteFeteVolunteer()

  const [open, setOpen] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [volunteerId, setVolunteerId] = useState('')
  const [roleKey, setRoleKey] = useState('Helper')
  const [roleOther, setRoleOther] = useState('')
  const [notes, setNotes] = useState('')
  const [dayInput, setDayInput] = useState('')
  const [days, setDays] = useState<string[]>([])
  const [availability, setAvailability] = useState<AvailabilitySlot[]>([])
  const [formError, setFormError] = useState('')

  const isAdmin = currentUser.role === 'admin'

  // Volunteers not already assigned to this fete (for the add dialog)
  const assignedVolunteerIds = new Set(volunteers.map((v) => v.volunteer_id ?? v.user_id ?? -1))
  const availableVolunteers = allVolunteers.filter((v) => !assignedVolunteerIds.has(v.id))

  function clearForm() {
    setEditId(null)
    setEditName('')
    setVolunteerId('')
    setRoleKey('Helper')
    setRoleOther('')
    setNotes('')
    setDayInput('')
    setDays([])
    setAvailability([])
    setFormError('')
  }

  function openAdd() {
    clearForm()
    setOpen(true)
  }

  function openEdit(v: Volunteer) {
    setEditId(v.id)
    setEditName(v.user_name)
    setVolunteerId(String(v.volunteer_id ?? v.user_id ?? ''))
    setRoleKey(v.role_key && ROLE_OPTIONS.includes(v.role_key) ? v.role_key : 'Other')
    setRoleOther(v.role_key === 'Other' ? v.role_other : '')
    setNotes(v.notes)
    setDayInput('')
    const uniqueDays = Array.from(new Set((v.availability ?? []).map((slot) => slot.date))).sort()
    setDays(uniqueDays)
    setAvailability(v.availability ?? [])
    setFormError('')
    setOpen(true)
  }

  function addDay() {
    const nextDay = dayInput.trim()
    if (!nextDay) return
    if (days.includes(nextDay)) {
      setFormError('Day already selected')
      return
    }

    const nextDays = [...days, nextDay].sort()
    if (nextDays.length > 3) {
      setFormError('You can select up to 3 days')
      return
    }
    if (!isConsecutive(nextDays)) {
      setFormError('Days must be consecutive')
      return
    }

    setDays(nextDays)
    setDayInput('')
    setFormError('')
  }

  function removeDay(day: string) {
    const nextDays = days.filter((entry) => entry !== day)
    setDays(nextDays)
    setAvailability((prev) => prev.filter((slot) => slot.date !== day))
    setFormError('')
  }

  function toggleSlot(date: string, startHour: number) {
    const slotKey = `${date}:${startHour}`
    setAvailability((prev) => {
      const exists = prev.some((slot) => `${slot.date}:${slot.start_hour}` === slotKey)
      if (exists) {
        return prev.filter((slot) => `${slot.date}:${slot.start_hour}` !== slotKey)
      }
      return [...prev, { date, start_hour: startHour, end_hour: startHour + 1 }]
    })
  }

  async function handleSave() {
    setFormError('')

    if (roleKey === 'Other' && !roleOther.trim()) {
      setFormError('Please provide a custom role')
      return
    }

    const daySet = Array.from(new Set(availability.map((slot) => slot.date))).sort()
    if (daySet.length > 3) {
      setFormError('Availability can cover up to 3 days')
      return
    }
    if (!isConsecutive(daySet)) {
      setFormError('Availability days must be consecutive')
      return
    }

    const selectedVolunteerId = Number(volunteerId)
    if (!editId && !Number.isInteger(selectedVolunteerId)) {
      setFormError('Please choose a volunteer')
      return
    }

    await saveVolunteer({
      ...(editId ? { id: editId } : {}),
      fete_id: feteId,
      volunteer_id: selectedVolunteerId,
      role: roleKey,
      role_other: roleKey === 'Other' ? roleOther.trim() : '',
      notes,
      availability,
    })

    setOpen(false)
    clearForm()
    onRefresh()
  }

  async function handleDelete(id: number) {
    if (!confirm('Remove this volunteer from the fete?')) return
    await deleteVolunteer({ id })
    onRefresh()
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <UserCheck className="w-4 h-4" />
          Volunteers ({volunteers.length})
        </h3>
        {isAdmin && availableVolunteers.length > 0 && (
          <Button size="sm" variant="outline" onClick={openAdd} className="flex items-center gap-1">
            <Plus className="w-3 h-3" /> Add Volunteer
          </Button>
        )}
      </div>

      {volunteers.length === 0 ? (
        <p className="text-sm text-muted-foreground">No volunteers assigned yet.</p>
      ) : (
        <div className="space-y-2">
          {volunteers.map(v => (
            <div key={v.id} className="flex items-center gap-3 px-3 py-2 rounded-md border border-border bg-background">
              <div className={`p-1.5 rounded-full flex-shrink-0 ${v.user_role === 'admin' ? 'bg-primary/10' : 'bg-muted'}`}>
                {v.user_role === 'admin'
                  ? <Shield className="w-3.5 h-3.5 text-primary" />
                  : <User className="w-3.5 h-3.5 text-muted-foreground" />
                }
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium">{v.user_name}</span>
                  {v.role && (
                    <Badge variant="secondary" className="text-xs">{v.role}</Badge>
                  )}
                  {v.availability?.length > 0 && (
                    <Badge variant="outline" className="text-xs">{slotSummary(v.availability)}</Badge>
                  )}
                </div>
                {v.notes && (
                  <p className="text-xs text-muted-foreground mt-0.5">{v.notes}</p>
                )}
              </div>
              {isAdmin && (
                <div className="flex gap-1 flex-shrink-0">
                  <Button
                    size="sm" variant="ghost"
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                    aria-label="Edit volunteer"
                    onClick={() => openEdit(v)}
                  >
                    <Pencil className="w-3 h-3" />
                  </Button>
                  <Button
                    size="sm" variant="ghost"
                    className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                    aria-label="Remove volunteer"
                    onClick={() => handleDelete(v.id)}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editId ? `Edit - ${editName}` : 'Add Volunteer'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {!editId && (
              <div className="space-y-1">
                <Label>Person</Label>
                <Select value={volunteerId} onValueChange={setVolunteerId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a volunteer…" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableVolunteers.map((person) => (
                      <SelectItem key={person.id} value={String(person.id)}>
                        {person.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1">
              <Label>Role / Task</Label>
              <Select value={roleKey} onValueChange={setRoleKey}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((role) => (
                    <SelectItem key={role} value={role}>{role}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {roleKey === 'Other' && (
                <Input
                  value={roleOther}
                  onChange={(e) => setRoleOther(e.target.value)}
                  placeholder="Enter custom role"
                />
              )}
            </div>
            <div className="space-y-1">
              <Label>Availability (09:00-18:00, up to 3 consecutive days)</Label>
              <div className="flex gap-2">
                <Input type="date" value={dayInput} onChange={(e) => setDayInput(e.target.value)} />
                <Button type="button" variant="outline" onClick={addDay}>Add Day</Button>
              </div>
              {days.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {days.map((day) => (
                    <Button
                      key={day}
                      type="button"
                      variant="secondary"
                      className="h-7 px-2 text-xs"
                      onClick={() => removeDay(day)}
                    >
                      {day} x
                    </Button>
                  ))}
                </div>
              )}
              {days.map((day) => (
                <div key={day} className="space-y-1 border border-border rounded-md p-2">
                  <p className="text-xs font-medium">{day}</p>
                  <div className="flex flex-wrap gap-1">
                    {HOUR_BLOCKS.map((startHour) => {
                      const active = availability.some(
                        (slot) => slot.date === day && slot.start_hour === startHour,
                      )
                      return (
                        <Button
                          key={`${day}:${startHour}`}
                          type="button"
                          variant={active ? 'default' : 'outline'}
                          className="h-7 px-2 text-xs"
                          onClick={() => toggleSlot(day, startHour)}
                        >
                          {formatHour(startHour)}
                        </Button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
            <div className="space-y-1">
              <Label>Notes <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="e.g. Arrives at 9am"
              />
            </div>
            {formError && <p className="text-sm text-destructive">{formError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || (!editId && !volunteerId)}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
