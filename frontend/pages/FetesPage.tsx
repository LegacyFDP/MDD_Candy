import { useEffect, useState } from 'react'
import {
  useGetFetes, useSaveFete, useGetWithdrawals,
  useGetFeteVolunteers, useGetUsers,
  useGetFeteLocations, useSaveFeteLocation, useDeleteFeteLocation
} from '../hooks/backend/fete'
import { Button } from '../lib/shadcn/button'
import { Input } from '../lib/shadcn/input'
import { Label } from '../lib/shadcn/label'
import { Badge } from '../lib/shadcn/badge'
import { Textarea } from '../lib/shadcn/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../lib/shadcn/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../lib/shadcn/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../lib/shadcn/select'
import { Plus, ChevronDown, ChevronUp, ArrowUpFromLine, UserCheck, MapPin, Settings, Trash2 } from 'lucide-react'
import FeteVolunteers from './ui/FeteVolunteers'
import type { AppUser } from './Login'

interface Props { currentUser: AppUser }

type Fete = {
  id: number; name: string; event_date: string; description: string
  status: 'planned' | 'active' | 'completed'; created_by_name: string; created_at: string
  location_id: number | null; location_name: string | null
}
type FeteLocation = { id: number; name: string; description: string }
type Withdrawal = {
  id: number; fete_id: number | null; asset_id: number; asset_name: string
  category: string; quantity: number; status: string
  withdrawn_at: string; returned_at: string | null
  withdrawn_by_name: string; notes: string
}
type FeteUser = { id: number; name: string; role: string; email: string }

const STATUS_COLORS: Record<string, string> = {
  planned: 'secondary',
  active: 'default',
  completed: 'outline',
}

const emptyFete = (): Partial<Fete> => ({
  name: '', event_date: '', description: '', status: 'planned', location_id: null,
})

export default function FetesPage({ currentUser }: Props) {
  const { data: fetesRaw, trigger: loadFetes } = useGetFetes()
  const { trigger: saveFete, loading: savingFete } = useSaveFete()
  const { data: withdrawalsRaw, trigger: loadWithdrawals } = useGetWithdrawals()
  const { data: volunteersRaw, trigger: loadVolunteers } = useGetFeteVolunteers()
  const { data: usersRaw, trigger: loadUsers } = useGetUsers()
  const { data: locationsRaw, trigger: loadLocations } = useGetFeteLocations()
  const { trigger: saveFeteLocation, loading: savingLocation } = useSaveFeteLocation()
  const { trigger: deleteFeteLocation } = useDeleteFeteLocation()

  const fetes = (fetesRaw ?? []) as Fete[]
  const allWithdrawals = (withdrawalsRaw ?? []) as Withdrawal[]
  const allVolunteers = (volunteersRaw ?? []) as import('./ui/FeteVolunteers').Volunteer[]
  const allUsers = (usersRaw ?? []) as FeteUser[]
  const locations = (locationsRaw ?? []) as FeteLocation[]

  const [feteOpen, setFeteOpen] = useState(false)
  const [feteForm, setFeteForm] = useState<Partial<Fete>>(emptyFete())
  const [editFeteId, setEditFeteId] = useState<number | null>(null)
  const [expandedFeteId, setExpandedFeteId] = useState<number | null>(null)

  const [manageLocationsOpen, setManageLocationsOpen] = useState(false)
  const [newLocationName, setNewLocationName] = useState('')
  const [newLocationDescription, setNewLocationDescription] = useState('')

  const isAdmin = currentUser.role === 'admin'

  useEffect(() => {
    void loadFetes({})
    void loadWithdrawals({})
    void loadVolunteers({})
    void loadUsers({})
    void loadLocations({})
  }, [])

  async function handleAddLocation() {
    if (!newLocationName.trim()) return
    await saveFeteLocation({ name: newLocationName.trim(), description: newLocationDescription.trim() })
    setNewLocationName('')
    setNewLocationDescription('')
    void loadLocations({})
  }

  async function handleDeleteLocation(id: number) {
    await deleteFeteLocation({ id })
    if (feteForm.location_id === id) {
      setFeteForm(f => ({ ...f, location_id: null }))
    }
    void loadLocations({})
  }

  function openNewFete() {
    setFeteForm(emptyFete())
    setEditFeteId(null)
    setFeteOpen(true)
  }

  function openEditFete(f: Fete) {
    const dateStr = f.event_date.split('T')[0] ?? f.event_date
    setFeteForm({ ...f, event_date: dateStr, location_id: f.location_id ?? null })
    setEditFeteId(f.id)
    setFeteOpen(true)
  }

  async function handleSaveFete() {
    await saveFete({
      ...(editFeteId ? { id: editFeteId } : {}),
      name: feteForm.name ?? '',
      event_date: feteForm.event_date ?? '',
      description: feteForm.description ?? '',
      status: feteForm.status ?? 'planned',
      created_by: currentUser.id,
      ...(feteForm.location_id != null ? { location_id: feteForm.location_id } : {}),
    })
    setFeteOpen(false)
    void loadFetes({})
  }

  function toggleExpand(feteId: number) {
    setExpandedFeteId(prev => prev === feteId ? null : feteId)
  }

  function refreshVolunteers() {
    void loadVolunteers({}, { skipCache: true })
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Fete Events</h1>
          <p className="text-muted-foreground text-sm">Manage events, equipment and volunteers</p>
        </div>
        <Button onClick={openNewFete} className="flex items-center gap-2">
          <Plus className="w-4 h-4" /> New Fete
        </Button>
      </div>

      {fetes.length === 0 && (
        <p className="text-muted-foreground">No fetes yet. Create one to get started.</p>
      )}

      <div className="space-y-3">
        {fetes.map(fete => {
          const isExpanded = expandedFeteId === fete.id
          const feteWithdrawals = allWithdrawals.filter(w => w.fete_id === fete.id)
          const feteVolunteers = allVolunteers.filter(v => v.fete_id === fete.id)
          const itemsOut = feteWithdrawals.filter(w => w.status === 'out').length

          return (
            <div key={fete.id} className="border rounded-lg bg-card text-card-foreground">
              {/* Fete header row */}
              <div className="p-4 flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-lg">{fete.name}</span>
                    <Badge variant={STATUS_COLORS[fete.status] as 'default' | 'secondary' | 'outline' | 'destructive'}>
                      {fete.status}
                    </Badge>
                    {itemsOut > 0 && (
                      <Badge variant="secondary">{itemsOut} item{itemsOut !== 1 ? 's' : ''} out</Badge>
                    )}
                    {feteVolunteers.length > 0 && (
                      <Badge variant="outline" className="flex items-center gap-1">
                        <UserCheck className="w-3 h-3" />
                        {feteVolunteers.length} volunteer{feteVolunteers.length !== 1 ? 's' : ''}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {new Date(fete.event_date).toLocaleDateString('en-GB', {
                      day: 'numeric', month: 'long', year: 'numeric',
                    })}
                    {fete.description && ` · ${fete.description}`}
                  </p>
                  {fete.location_name && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <MapPin className="w-3 h-3" />{fete.location_name}
                    </p>
                  )}
                  {feteWithdrawals.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {feteWithdrawals.length} withdrawal{feteWithdrawals.length !== 1 ? 's' : ''}
                      {itemsOut > 0 ? ` · ${itemsOut} still out` : ' · all returned'}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {isAdmin && (
                    <Button size="sm" variant="outline" onClick={() => openEditFete(fete)}>Edit</Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => toggleExpand(fete.id)}>
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </Button>
                </div>
              </div>

              {/* Expanded panel with tabs */}
              {isExpanded && (
                <div className="border-t border-border p-4">
                  <Tabs defaultValue="withdrawals">
                    <TabsList className="mb-4">
                      <TabsTrigger value="withdrawals" className="flex items-center gap-1.5">
                        <ArrowUpFromLine className="w-3.5 h-3.5" />
                        Equipment ({feteWithdrawals.length})
                      </TabsTrigger>
                      <TabsTrigger value="volunteers" className="flex items-center gap-1.5">
                        <UserCheck className="w-3.5 h-3.5" />
                        Volunteers ({feteVolunteers.length})
                      </TabsTrigger>
                    </TabsList>

                    {/* Withdrawals tab */}
                    <TabsContent value="withdrawals">
                      {feteWithdrawals.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No items withdrawn for this fete.</p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-muted-foreground border-b border-border">
                                <th className="text-left py-1 font-medium">Item</th>
                                <th className="text-center py-1 font-medium">Qty</th>
                                <th className="text-left py-1 font-medium">By</th>
                                <th className="text-left py-1 font-medium">When</th>
                                <th className="text-center py-1 font-medium">Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {feteWithdrawals.map(w => (
                                <tr key={w.id} className="border-b border-border last:border-0">
                                  <td className="py-2 font-medium">
                                    {w.asset_name}
                                    <span className="text-muted-foreground text-xs ml-1">({w.category})</span>
                                  </td>
                                  <td className="py-2 text-center">{w.quantity}</td>
                                  <td className="py-2 text-muted-foreground">{w.withdrawn_by_name}</td>
                                  <td className="py-2 text-muted-foreground text-xs">
                                    {new Date(w.withdrawn_at).toLocaleDateString('en-GB', {
                                      day: 'numeric', month: 'short', year: 'numeric',
                                    })}
                                  </td>
                                  <td className="py-2 text-center">
                                    <Badge variant={w.status === 'out' ? 'secondary' : 'outline'}>
                                      {w.status}
                                    </Badge>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </TabsContent>

                    {/* Volunteers tab */}
                    <TabsContent value="volunteers">
                      <FeteVolunteers
                        feteId={fete.id}
                        volunteers={feteVolunteers}
                        allUsers={allUsers}
                        currentUser={currentUser}
                        onRefresh={refreshVolunteers}
                      />
                    </TabsContent>
                  </Tabs>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Fete create/edit dialog */}
      <Dialog open={feteOpen} onOpenChange={setFeteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editFeteId ? 'Edit Fete' : 'New Fete Event'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Event Name</Label>
              <Input
                value={feteForm.name ?? ''}
                onChange={e => setFeteForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Date</Label>
              <Input
                type="date"
                value={feteForm.event_date ?? ''}
                onChange={e => setFeteForm(f => ({ ...f, event_date: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Description</Label>
              <Textarea
                value={feteForm.description ?? ''}
                onChange={e => setFeteForm(f => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Status</Label>
              <Select
                {...(feteForm.status ? { value: feteForm.status } : {})}
                onValueChange={v => setFeteForm(f => ({ ...f, status: v as Fete['status'] }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="planned">Planned</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label>Location</Label>
                <Button
                  type="button" size="sm" variant="ghost"
                  className="h-6 px-2 text-xs flex items-center gap-1"
                  onClick={() => setManageLocationsOpen(true)}
                >
                  <Settings className="w-3 h-3" /> Manage
                </Button>
              </div>
              <Select
                value={feteForm.location_id != null ? String(feteForm.location_id) : 'none'}
                onValueChange={v =>
                  setFeteForm(f => ({ ...f, location_id: v === 'none' ? null : parseInt(v) }))
                }
              >
                <SelectTrigger><SelectValue placeholder="— none —" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— none —</SelectItem>
                  {locations.map(l => (
                    <SelectItem key={l.id} value={String(l.id)}>{l.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFeteOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveFete} disabled={savingFete || !feteForm.name}>
              {savingFete ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manage fete locations dialog */}
      <Dialog open={manageLocationsOpen} onOpenChange={setManageLocationsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Fete Locations</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {locations.map(l => (
                <div key={l.id} className="flex items-start gap-2 border rounded-md p-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{l.name}</p>
                    {l.description && (
                      <p className="text-xs text-muted-foreground">{l.description}</p>
                    )}
                  </div>
                  <Button
                    size="sm" variant="outline"
                    onClick={() => handleDeleteLocation(l.id)}
                    aria-label={`Delete ${l.name}`}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              ))}
              {locations.length === 0 && (
                <p className="text-sm text-muted-foreground">No event locations defined yet.</p>
              )}
            </div>
            <div className="border-t border-border pt-3 space-y-2">
              <div className="space-y-1">
                <Label>New Location Name</Label>
                <Input value={newLocationName} onChange={e => setNewLocationName(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Description</Label>
                <Input
                  value={newLocationDescription}
                  onChange={e => setNewLocationDescription(e.target.value)}
                  placeholder="e.g. Main outdoor event space"
                />
              </div>
              <Button
                onClick={handleAddLocation}
                disabled={savingLocation || !newLocationName.trim()}
                className="flex items-center gap-2"
              >
                <Plus className="w-4 h-4" /> Add Location
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setManageLocationsOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
