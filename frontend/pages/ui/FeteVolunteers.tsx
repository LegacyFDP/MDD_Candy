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

export type Volunteer = {
  id: number
  fete_id: number
  user_id: number
  user_name: string
  email: string
  user_role: string
  role: string
  notes: string
  added_at: string
}

export type FeteUser = { id: number; name: string; role: string; email: string }

interface Props {
  feteId: number
  volunteers: Volunteer[]
  allUsers: FeteUser[]
  currentUser: AppUser
  onRefresh: () => void
}

const SUGGESTED_ROLES = ['Cashier', 'Setup', 'Teardown', 'Tombola', 'Coordinator', 'Float', 'Greeter', 'Other']

export default function FeteVolunteers({ feteId, volunteers, allUsers, currentUser, onRefresh }: Props) {
  const { trigger: saveVolunteer, loading: saving } = useSaveFeteVolunteer()
  const { trigger: deleteVolunteer } = useDeleteFeteVolunteer()

  const [open, setOpen] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [editUserName, setEditUserName] = useState('')
  const [userId, setUserId] = useState('')
  const [role, setRole] = useState('')
  const [notes, setNotes] = useState('')

  const isAdmin = currentUser.role === 'admin'

  // Users not already assigned to this fete (for the add dialog)
  const assignedUserIds = new Set(volunteers.map(v => v.user_id))
  const availableUsers = allUsers.filter(u => !assignedUserIds.has(u.id))

  function openAdd() {
    setEditId(null)
    setEditUserName('')
    setUserId('')
    setRole('')
    setNotes('')
    setOpen(true)
  }

  function openEdit(v: Volunteer) {
    setEditId(v.id)
    setEditUserName(v.user_name)
    setUserId(String(v.user_id))
    setRole(v.role)
    setNotes(v.notes)
    setOpen(true)
  }

  async function handleSave() {
    await saveVolunteer({
      ...(editId ? { id: editId } : {}),
      fete_id: feteId,
      user_id: parseInt(userId),
      role,
      notes,
    })
    setOpen(false)
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
        {isAdmin && availableUsers.length > 0 && (
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
            <DialogTitle>{editId ? `Edit — ${editUserName}` : 'Add Volunteer'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {!editId && (
              <div className="space-y-1">
                <Label>Person</Label>
                <Select value={userId} onValueChange={setUserId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a volunteer…" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableUsers.map(u => (
                      <SelectItem key={u.id} value={String(u.id)}>
                        {u.name}
                        {u.role === 'admin' && (
                          <span className="ml-1 text-muted-foreground text-xs">(admin)</span>
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1">
              <Label>Role / Task</Label>
              <Input
                value={role}
                onChange={e => setRole(e.target.value)}
                placeholder="e.g. Cashier, Setup, Tombola"
                list="role-suggestions"
              />
              <datalist id="role-suggestions">
                {SUGGESTED_ROLES.map(r => <option key={r} value={r} />)}
              </datalist>
            </div>
            <div className="space-y-1">
              <Label>Notes <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="e.g. Arrives at 9am"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || (!editId && !userId)}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
