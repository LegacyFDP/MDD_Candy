import { useEffect, useState } from 'react'
import {
  useGetFetes, useSaveFete, useGetWithdrawals,
  useGetFeteLocations, useSaveFeteLocation, useDeleteFeteLocation, useArchiveFete
} from '../hooks/backend/fete'
import { Button } from '../lib/shadcn/button'
import { Input } from '../lib/shadcn/input'
import { Label } from '../lib/shadcn/label'
import { Badge } from '../lib/shadcn/badge'
import { Textarea } from '../lib/shadcn/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../lib/shadcn/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../lib/shadcn/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../lib/shadcn/select'
import { Tooltip, TooltipContent, TooltipTrigger } from '../lib/shadcn/tooltip'
import { Plus, ChevronDown, ChevronUp, ArrowUpFromLine, MapPin, Settings, Trash2, Pencil, Archive, RotateCcw, Search } from 'lucide-react'
import type { AppUser } from './Login'

interface Props { currentUser: AppUser }

type Fete = {
  id: number; name: string; event_date: string; description: string
  notes: string
  status: 'planned' | 'active' | 'completed'; created_by_name: string; created_at: string
  location_id: number | null; location_name: string | null
  archived_at: string | null; archived_by_name: string | null
}
type FeteLocation = {
  id: number
  name: string
  description: string
  notes: string
  address_line1: string
  address_line2: string
  town_city: string
  county: string
  postcode: string
}
type Withdrawal = {
  id: number; fete_id: number | null; asset_id: number; asset_name: string
  category: string; quantity: number; status: string
  withdrawn_at: string; returned_at: string | null
  withdrawn_by_name: string; notes: string
}

const STATUS_COLORS: Record<string, string> = {
  planned: 'secondary',
  active: 'default',
  completed: 'outline',
}

const emptyFete = (): Partial<Fete> => ({
  name: '', event_date: '', description: '', notes: '', status: 'planned', location_id: null,
})

const emptyFeteLocation = (): Partial<FeteLocation> => ({
  name: '',
  description: '',
  notes: '',
  address_line1: '',
  address_line2: '',
  town_city: '',
  county: '',
  postcode: '',
})

export default function FetesPage({ currentUser }: Props) {
  const { data: fetesRaw, trigger: loadFetes } = useGetFetes()
  const { trigger: saveFete, loading: savingFete } = useSaveFete()
  const { data: withdrawalsRaw, trigger: loadWithdrawals } = useGetWithdrawals()
  const { data: locationsRaw, trigger: loadLocations } = useGetFeteLocations()
  const { trigger: saveFeteLocation, loading: savingLocation } = useSaveFeteLocation()
  const { trigger: deleteFeteLocation } = useDeleteFeteLocation()
  const { trigger: archiveFete, loading: archivingFete } = useArchiveFete()

  const fetes = (fetesRaw ?? []) as Fete[]
  const allWithdrawals = (withdrawalsRaw ?? []) as Withdrawal[]
  const locations = (locationsRaw ?? []) as FeteLocation[]
  const [search, setSearch] = useState('')
  const [eventView, setEventView] = useState<'active' | 'archived' | 'all'>('all')

  const [feteOpen, setFeteOpen] = useState(false)
  const [feteForm, setFeteForm] = useState<Partial<Fete>>(emptyFete())
  const [editFeteId, setEditFeteId] = useState<number | null>(null)
  const [expandedFeteId, setExpandedFeteId] = useState<number | null>(null)

  const [manageLocationsOpen, setManageLocationsOpen] = useState(false)
  const [editLocationId, setEditLocationId] = useState<number | null>(null)
  const [locationForm, setLocationForm] = useState<Partial<FeteLocation>>(emptyFeteLocation())
  const [locationError, setLocationError] = useState('')

  const isAdmin = currentUser.role === 'admin'

  const visibleFetes = fetes.filter(fete => {
    const archived = Boolean(fete.archived_at)
    if (eventView === 'active' && archived) return false
    if (eventView === 'archived' && !archived) return false

    const query = search.trim().toLowerCase()
    if (!query) return true
    return [fete.name, fete.description, fete.notes, fete.location_name, fete.status, fete.archived_by_name]
      .filter(Boolean)
      .some(value => String(value).toLowerCase().includes(query))
  })

  useEffect(() => {
    void loadFetes({})
    void loadWithdrawals({})
    void loadLocations({})
  }, [])

  function openNewLocationForm() {
    setLocationError('')
    setEditLocationId(null)
    setLocationForm(emptyFeteLocation())
  }

  function openEditLocation(location: FeteLocation) {
    setLocationError('')
    setEditLocationId(location.id)
    setLocationForm({ ...location })
  }

  async function handleSaveLocation() {
    setLocationError('')
    if (!locationForm.name?.trim()) {
      setLocationError('Location name is required')
      return
    }

    try {
      await saveFeteLocation({
        ...(editLocationId ? { id: editLocationId } : {}),
        name: locationForm.name ?? '',
        description: locationForm.description ?? '',
        notes: locationForm.notes ?? '',
        address_line1: locationForm.address_line1 ?? '',
        address_line2: locationForm.address_line2 ?? '',
        town_city: locationForm.town_city ?? '',
        county: locationForm.county ?? '',
        postcode: locationForm.postcode ?? '',
      })

      openNewLocationForm()
      void loadLocations({})
    } catch (error) {
      setLocationError(error instanceof Error ? error.message : 'Failed to save location')
    }
  }

  async function handleDeleteLocation(id: number) {
    if (!confirm('Delete this fete location?')) return
    await deleteFeteLocation({ id })

    if (feteForm.location_id === id) {
      setFeteForm(f => ({ ...f, location_id: null }))
    }

    if (editLocationId === id) {
      openNewLocationForm()
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
      notes: feteForm.notes ?? '',
      status: feteForm.status ?? 'planned',
      created_by: currentUser.id,
      ...(feteForm.location_id != null ? { location_id: feteForm.location_id } : {}),
    })
    setFeteOpen(false)
    void loadFetes({})
  }

  async function handleArchiveFete(fete: Fete) {
    const restoring = Boolean(fete.archived_at)
    const action = restoring ? 'restore' : 'archive'
    if (!confirm(`${restoring ? 'Restore' : 'Archive'} “${fete.name}”?`)) return

    await archiveFete({ id: fete.id, archived_by: currentUser.id, ...(restoring ? { restore: true } : {}) })
    setExpandedFeteId(null)
    void loadFetes({})
  }

  function toggleExpand(feteId: number) {
    setExpandedFeteId(prev => prev === feteId ? null : feteId)
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Fete Events</h1>
          <p className="text-muted-foreground text-sm">Manage events and track equipment usage</p>
        </div>
        <Button onClick={openNewFete} className="flex items-center gap-2">
          <Plus className="w-4 h-4" /> New Fete
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-xl">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search all events, including archived"
            className="pl-9"
            aria-label="Search all fete events"
          />
        </div>
        <div className="flex gap-2" role="group" aria-label="Event view">
          {(['active', 'archived', 'all'] as const).map(view => (
            <Button
              key={view}
              size="sm"
              variant={eventView === view ? 'default' : 'outline'}
              onClick={() => setEventView(view)}
            >
              {view[0].toUpperCase() + view.slice(1)}
            </Button>
          ))}
        </div>
      </div>

      {fetes.length === 0 && (
        <p className="text-muted-foreground">No fetes yet. Create one to get started.</p>
      )}

      {fetes.length > 0 && visibleFetes.length === 0 && (
        <p className="text-muted-foreground">No events match the current search or view.</p>
      )}

      <div className="space-y-3">
        {visibleFetes.map(fete => {
          const isExpanded = expandedFeteId === fete.id
          const feteWithdrawals = allWithdrawals.filter(w => w.fete_id === fete.id)
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
                    {fete.archived_at && <Badge variant="outline">Archived</Badge>}
                    {itemsOut > 0 && (
                      <Badge variant="secondary">{itemsOut} item{itemsOut !== 1 ? 's' : ''} out</Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {new Date(fete.event_date).toLocaleDateString('en-GB', {
                      day: 'numeric', month: 'long', year: 'numeric',
                    })}
                    {fete.description && ` · ${fete.description}`}
                  </p>
                  {fete.notes && (
                    <p className="text-xs text-muted-foreground mt-0.5">Note: {fete.notes}</p>
                  )}
                  {fete.location_name && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <MapPin className="w-3 h-3" />{fete.location_name}
                    </p>
                  )}
                  {fete.archived_at && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Archived {new Date(fete.archived_at).toLocaleDateString('en-GB', {
                        day: 'numeric', month: 'short', year: 'numeric',
                      })}
                      {fete.archived_by_name && ` by ${fete.archived_by_name}`}
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
                  {isAdmin && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="icon"
                          variant="outline"
                          onClick={() => void handleArchiveFete(fete)}
                          disabled={archivingFete}
                          aria-label={`${fete.archived_at ? 'Restore' : 'Archive'} ${fete.name}`}
                        >
                          {fete.archived_at ? <RotateCcw className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {fete.archived_at ? `Restore ${fete.name}` : `Archive ${fete.name}; keep its history`}
                      </TooltipContent>
                    </Tooltip>
                  )}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => toggleExpand(fete.id)}
                        aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${fete.name} details`}
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{isExpanded ? 'Hide equipment history' : 'Show equipment history'}</TooltipContent>
                  </Tooltip>
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
              <div className="flex items-center justify-between">
                <Label>Notes</Label>
                <span className="text-xs text-muted-foreground">{(feteForm.notes ?? '').length}/120</span>
              </div>
              <Input
                value={feteForm.notes ?? ''}
                maxLength={120}
                onChange={e => setFeteForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Optional"
              />
              {(feteForm.notes ?? '').length >= 120 && (
                <p className="text-xs text-red-600">Maximum 120 characters reached.</p>
              )}
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
                  onClick={() => {
                    openNewLocationForm()
                    setManageLocationsOpen(true)
                  }}
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
                    {l.notes && (
                      <p className="text-xs text-muted-foreground">Note: {l.notes}</p>
                    )}
                    {(l.address_line1 || l.address_line2 || l.town_city || l.county || l.postcode) && (
                      <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                        {l.address_line1 && <p>{l.address_line1}</p>}
                        {l.address_line2 && <p>{l.address_line2}</p>}
                        {(l.town_city || l.county) && (
                          <p>{[l.town_city, l.county].filter(Boolean).join(', ')}</p>
                        )}
                        {l.postcode && <p className="font-medium text-foreground/80">{l.postcode}</p>}
                      </div>
                    )}
                  </div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="icon" variant="outline"
                        onClick={() => openEditLocation(l)}
                        aria-label={`Edit ${l.name}`}
                      >
                        <Pencil className="w-3 h-3" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Edit {l.name}</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="icon" variant="outline"
                        onClick={() => handleDeleteLocation(l.id)}
                        aria-label={`Delete ${l.name}`}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Delete {l.name}</TooltipContent>
                  </Tooltip>
                </div>
              ))}
              {locations.length === 0 && (
                <p className="text-sm text-muted-foreground">No event locations defined yet.</p>
              )}
            </div>
            <div className="border-t border-border pt-3 space-y-2">
              <div className="space-y-1">
                <Label>Location Name</Label>
                <Input
                  value={locationForm.name ?? ''}
                  onChange={e => setLocationForm(f => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>Description</Label>
                <Input
                  value={locationForm.description ?? ''}
                  onChange={e => setLocationForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="e.g. Main outdoor event space"
                />
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label>Notes</Label>
                  <span className="text-xs text-muted-foreground">{(locationForm.notes ?? '').length}/120</span>
                </div>
                <Input
                  value={locationForm.notes ?? ''}
                  maxLength={120}
                  onChange={e => setLocationForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Optional"
                />
                {(locationForm.notes ?? '').length >= 120 && (
                  <p className="text-xs text-red-600">Maximum 120 characters reached.</p>
                )}
              </div>
              <div className="space-y-1">
                <Label>Address Line 1</Label>
                <Input
                  value={locationForm.address_line1 ?? ''}
                  onChange={e => setLocationForm(f => ({ ...f, address_line1: e.target.value }))}
                  placeholder="e.g. 12 Hall Lane"
                />
              </div>
              <div className="space-y-1">
                <Label>Address Line 2</Label>
                <Input
                  value={locationForm.address_line2 ?? ''}
                  onChange={e => setLocationForm(f => ({ ...f, address_line2: e.target.value }))}
                  placeholder="Optional"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Town / City</Label>
                  <Input
                    value={locationForm.town_city ?? ''}
                    onChange={e => setLocationForm(f => ({ ...f, town_city: e.target.value }))}
                    placeholder="e.g. Oxford"
                  />
                </div>
                <div className="space-y-1">
                  <Label>County</Label>
                  <Input
                    value={locationForm.county ?? ''}
                    onChange={e => setLocationForm(f => ({ ...f, county: e.target.value }))}
                    placeholder="Optional"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label>Postcode</Label>
                <Input
                  value={locationForm.postcode ?? ''}
                  onChange={e => setLocationForm(f => ({ ...f, postcode: e.target.value }))}
                  placeholder="e.g. 12345 or A1B 2C3"
                />
              </div>
              {locationError && (
                <p className="text-sm text-red-600">{locationError}</p>
              )}
              <Button
                onClick={handleSaveLocation}
                disabled={savingLocation || !locationForm.name?.trim()}
                className="flex items-center gap-2"
              >
                <Plus className="w-4 h-4" /> {editLocationId ? 'Save Location' : 'Add Location'}
              </Button>
              {editLocationId && (
                <Button variant="outline" onClick={openNewLocationForm}>Clear</Button>
              )}
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
