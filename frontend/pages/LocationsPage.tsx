import { useEffect, useState } from 'react'
import {
  useGetLocations, useSaveLocation, useArchiveLocation,
  useGetStorageAreas, useSaveStorageArea, useDeleteStorageArea,
} from '../hooks/backend/fete'
import { Button } from '../lib/shadcn/button'
import { Input } from '../lib/shadcn/input'
import { Label } from '../lib/shadcn/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../lib/shadcn/dialog'
import { Tooltip, TooltipContent, TooltipTrigger } from '../lib/shadcn/tooltip'
import { Plus, Pencil, MapPin, Trash2, RotateCcw, Search, Layers } from 'lucide-react'
import type { AppUser } from './Login'

interface Props { currentUser: AppUser }

type Location = {
  id: number
  name: string
  description: string
  notes: string
  address_line1: string
  address_line2: string
  town_city: string
  county: string
  postcode: string
  archived_at: string | null
  archived_by_name: string | null
}

type StorageArea = {
  id: number
  location_id: number
  location_name: string
  name: string
  description: string
  notes: string
  created_at: string
}

export default function LocationsPage({ currentUser }: Props) {
  const { data: locationsRaw, trigger: loadLocations, loading: loadingLocations, error: locationsError } = useGetLocations()
  const { trigger: saveLocation, loading: saving } = useSaveLocation()
  const { trigger: archiveLocation, loading: archiving } = useArchiveLocation()
  const { data: areasRaw, trigger: loadAreas } = useGetStorageAreas()
  const { trigger: saveArea, loading: savingArea } = useSaveStorageArea()
  const { trigger: deleteArea, loading: deletingArea } = useDeleteStorageArea()

  const locations = (locationsRaw ?? []) as Location[]
  const areas = (areasRaw ?? []) as StorageArea[]

  const [open, setOpen] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [saveError, setSaveError] = useState('')
  const [search, setSearch] = useState('')
  const [locationView, setLocationView] = useState<'active' | 'archived' | 'all'>('active')
  const [areasOpen, setAreasOpen] = useState(false)
  const [areaLocation, setAreaLocation] = useState<Location | null>(null)
  const [areaEditId, setAreaEditId] = useState<number | null>(null)
  const [areaError, setAreaError] = useState('')
  const [areaForm, setAreaForm] = useState({ name: '', description: '', notes: '' })
  const [form, setForm] = useState<Partial<Location>>({
    name: '',
    description: '',
    notes: '',
    address_line1: '',
    address_line2: '',
    town_city: '',
    county: '',
    postcode: ''
  })

  useEffect(() => {
    void loadLocations({})
    void loadAreas({})
  }, [])

  const isAdmin = currentUser.role === 'admin'

  const visibleLocations = locations.filter(location => {
    const archived = Boolean(location.archived_at)
    if (locationView === 'active' && archived) return false
    if (locationView === 'archived' && !archived) return false

    const query = search.trim().toLowerCase()
    if (!query) return true
    return [
      location.name,
      location.description,
      location.notes,
      location.address_line1,
      location.address_line2,
      location.town_city,
      location.county,
      location.postcode,
      location.archived_by_name,
    ].filter(Boolean).some(value => String(value).toLowerCase().includes(query))
  })

  function openNew() {
    setSaveError('')
    setForm({
      name: '',
      description: '',
      notes: '',
      address_line1: '',
      address_line2: '',
      town_city: '',
      county: '',
      postcode: ''
    })
    setEditId(null)
    setOpen(true)
  }

  function openEdit(l: Location) {
    setSaveError('')
    setForm({ ...l })
    setEditId(l.id)
    setOpen(true)
  }

  async function handleSave() {
    setSaveError('')
    try {
      await saveLocation({
        ...(editId ? { id: editId } : {}),
        name: form.name ?? '',
        description: form.description ?? '',
        notes: form.notes ?? '',
        address_line1: form.address_line1 ?? '',
        address_line2: form.address_line2 ?? '',
        town_city: form.town_city ?? '',
        county: form.county ?? '',
        postcode: form.postcode ?? ''
      })
      setOpen(false)
      void loadLocations({})
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Failed to save location')
    }
  }

  async function handleArchive(location: Location) {
    const restoring = Boolean(location.archived_at)
    if (!confirm(`${restoring ? 'Restore' : 'Archive'} “${location.name}”?${restoring ? '' : ' Linked assets and event history will be preserved.'}`)) return

    await archiveLocation({
      id: location.id,
      archived_by: currentUser.id,
      ...(restoring ? { restore: true } : {}),
    })
    void loadLocations({})
  }

  function openAreas(location: Location) {
    setAreaLocation(location)
    setAreaEditId(null)
    setAreaError('')
    setAreaForm({ name: '', description: '', notes: '' })
    setAreasOpen(true)
  }

  function editArea(area: StorageArea) {
    setAreaEditId(area.id)
    setAreaError('')
    setAreaForm({ name: area.name, description: area.description, notes: area.notes })
  }

  function clearAreaForm() {
    setAreaEditId(null)
    setAreaError('')
    setAreaForm({ name: '', description: '', notes: '' })
  }

  async function handleSaveArea() {
    if (!areaLocation) return
    setAreaError('')
    try {
      await saveArea({
        ...(areaEditId ? { id: areaEditId } : {}),
        location_id: areaLocation.id,
        name: areaForm.name,
        description: areaForm.description,
        notes: areaForm.notes,
      })
      clearAreaForm()
      void loadAreas({})
    } catch (error) {
      setAreaError(error instanceof Error ? error.message : 'Failed to save Storage Area')
    }
  }

  async function handleDeleteArea(area: StorageArea) {
    if (!confirm(`Delete Storage Area “${area.name}”? This cannot be undone.`)) return
    try {
      await deleteArea({ id: area.id })
      if (areaEditId === area.id) clearAreaForm()
      void loadAreas({})
    } catch (error) {
      setAreaError(error instanceof Error ? error.message : 'Failed to delete Storage Area')
    }
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Store Locations</h1>
          <p className="text-muted-foreground text-sm">Physical storage spots in your charity store</p>
        </div>
        {isAdmin && (
          <Button onClick={openNew} className="flex items-center gap-2">
            <Plus className="w-4 h-4" /> Add Location
          </Button>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-xl">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search locations"
            className="pl-9"
            aria-label="Search store locations"
          />
        </div>
        <div className="flex gap-2" role="group" aria-label="Location view">
          {(['active', 'archived', 'all'] as const).map(view => (
            <Button
              key={view}
              size="sm"
              variant={locationView === view ? 'default' : 'outline'}
              onClick={() => setLocationView(view)}
            >
              {view[0].toUpperCase() + view.slice(1)}
            </Button>
          ))}
        </div>
      </div>

      {locationsError && (
        <p className="text-sm text-destructive" role="alert">
          Unable to load Store Locations: {locationsError.message}
        </p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {visibleLocations.map(loc => (
          <div key={loc.id} className="border rounded-lg p-4 bg-card text-card-foreground flex items-start gap-3">
            <div className="bg-primary/10 p-2 rounded-full flex-shrink-0">
              <MapPin className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium">{loc.name}</p>
              {loc.archived_at && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Archived {new Date(loc.archived_at).toLocaleDateString('en-GB', {
                    day: 'numeric', month: 'short', year: 'numeric',
                  })}
                  {loc.archived_by_name && ` by ${loc.archived_by_name}`}
                </p>
              )}
              <div className="mt-2 flex items-center gap-2">
                <Layers className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">
                  {areas.filter(area => area.location_id === loc.id).length} Storage Area{areas.filter(area => area.location_id === loc.id).length !== 1 ? 's' : ''}
                </span>
              </div>
              {loc.description && (
                <p className="text-sm text-muted-foreground mt-0.5">{loc.description}</p>
              )}
              {loc.notes && (
                <p className="text-xs text-muted-foreground mt-0.5">Note: {loc.notes}</p>
              )}
              {(loc.address_line1 || loc.address_line2 || loc.town_city || loc.county || loc.postcode) && (
                <div className="text-sm text-muted-foreground mt-1 space-y-0.5">
                  {loc.address_line1 && <p>{loc.address_line1}</p>}
                  {loc.address_line2 && <p>{loc.address_line2}</p>}
                  {(loc.town_city || loc.county) && (
                    <p>
                      {[loc.town_city, loc.county].filter(Boolean).join(', ')}
                    </p>
                  )}
                  {loc.postcode && <p className="font-medium text-foreground/80">{loc.postcode}</p>}
                </div>
              )}
            </div>
            {isAdmin && (
              <div className="flex items-center gap-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="icon" variant="outline" onClick={() => openEdit(loc)}
                      aria-label={`Edit ${loc.name}`}>
                      <Pencil className="w-3 h-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Edit {loc.name}</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => void handleArchive(loc)}
                      disabled={archiving}
                      aria-label={`${loc.archived_at ? 'Restore' : 'Archive'} ${loc.name}`}
                    >
                      {loc.archived_at ? <RotateCcw className="w-3 h-3" /> : <Trash2 className="w-3 h-3" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {loc.archived_at ? `Restore ${loc.name}` : `Archive ${loc.name}; preserve linked history`}
                  </TooltipContent>
                </Tooltip>
                {!loc.archived_at && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button size="icon" variant="outline" onClick={() => openAreas(loc)} aria-label={`Manage Storage Areas for ${loc.name}`}>
                        <Layers className="w-3 h-3" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Manage Storage Areas</TooltipContent>
                  </Tooltip>
                )}
              </div>
            )}
          </div>
        ))}
        {locations.length > 0 && visibleLocations.length === 0 && (
          <p className="text-muted-foreground col-span-full">No locations match the current search or view.</p>
        )}
        {!loadingLocations && !locationsError && locations.length === 0 && (
          <p className="text-muted-foreground col-span-full">No locations defined yet.</p>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editId ? 'Edit Location' : 'Add Store Location'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Location Name</Label>
              <Input value={form.name ?? ''}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Description</Label>
              <Input value={form.description ?? ''}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="e.g. Large room at the back of the hall" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label>Notes</Label>
                <span className="text-xs text-muted-foreground">{(form.notes ?? '').length}/120</span>
              </div>
              <Input value={form.notes ?? ''}
                maxLength={120}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Optional" />
              {(form.notes ?? '').length >= 120 && (
                <p className="text-xs text-red-600">Maximum 120 characters reached.</p>
              )}
            </div>
            <div className="space-y-1">
              <Label>Address Line 1</Label>
              <Input value={form.address_line1 ?? ''}
                onChange={e => setForm(f => ({ ...f, address_line1: e.target.value }))}
                placeholder="e.g. 12 Hall Lane" />
            </div>
            <div className="space-y-1">
              <Label>Address Line 2</Label>
              <Input value={form.address_line2 ?? ''}
                onChange={e => setForm(f => ({ ...f, address_line2: e.target.value }))}
                placeholder="Optional" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Town / City</Label>
                <Input value={form.town_city ?? ''}
                  onChange={e => setForm(f => ({ ...f, town_city: e.target.value }))}
                  placeholder="e.g. Oxford" />
              </div>
              <div className="space-y-1">
                <Label>County</Label>
                <Input value={form.county ?? ''}
                  onChange={e => setForm(f => ({ ...f, county: e.target.value }))}
                  placeholder="Optional" />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Postcode</Label>
              <Input value={form.postcode ?? ''}
                onChange={e => setForm(f => ({ ...f, postcode: e.target.value }))}
                placeholder="e.g. 12345 or A1B 2C3" />
            </div>
            {saveError && (
              <p className="text-sm text-red-600">{saveError}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              onClick={handleSave}
              disabled={
                saving ||
                !form.name
              }
            >
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={areasOpen} onOpenChange={setAreasOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Storage Areas · {areaLocation?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2 max-h-56 overflow-y-auto">
              {areas.filter(area => area.location_id === areaLocation?.id).map(area => (
                <div key={area.id} className="flex items-start gap-2 border rounded-md p-2">
                  <Layers className="w-4 h-4 text-muted-foreground mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{area.name}</p>
                    {area.description && <p className="text-xs text-muted-foreground">{area.description}</p>}
                    {area.notes && <p className="text-xs text-muted-foreground">Note: {area.notes}</p>}
                  </div>
                  {isAdmin && (
                    <>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button size="icon" variant="outline" onClick={() => editArea(area)} aria-label={`Edit ${area.name}`}>
                            <Pencil className="w-3 h-3" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Edit {area.name}</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button size="icon" variant="outline" onClick={() => void handleDeleteArea(area)} disabled={deletingArea} aria-label={`Delete ${area.name}`}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Delete {area.name}</TooltipContent>
                      </Tooltip>
                    </>
                  )}
                </div>
              ))}
              {areas.filter(area => area.location_id === areaLocation?.id).length === 0 && (
                <p className="text-sm text-muted-foreground">No Storage Areas defined yet.</p>
              )}
            </div>
            {isAdmin && (
              <div className="border-t border-border pt-3 space-y-2">
                <div className="space-y-1">
                  <Label>Area Name</Label>
                  <Input value={areaForm.name} onChange={e => setAreaForm(form => ({ ...form, name: e.target.value }))} placeholder="e.g. Shelf A" />
                </div>
                <div className="space-y-1">
                  <Label>Description</Label>
                  <Input value={areaForm.description} onChange={e => setAreaForm(form => ({ ...form, description: e.target.value }))} placeholder="Optional" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label>Notes</Label>
                    <span className="text-xs text-muted-foreground">{areaForm.notes.length}/120</span>
                  </div>
                  <Input value={areaForm.notes} maxLength={120} onChange={e => setAreaForm(form => ({ ...form, notes: e.target.value }))} placeholder="Optional" />
                </div>
                {areaError && <p className="text-sm text-red-600">{areaError}</p>}
                <div className="flex gap-2">
                  <Button onClick={() => void handleSaveArea()} disabled={savingArea || !areaForm.name.trim()}>
                    <Plus className="w-4 h-4 mr-1" /> {areaEditId ? 'Save Area' : 'Add Area'}
                  </Button>
                  {areaEditId && <Button variant="outline" onClick={clearAreaForm}>Clear</Button>}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAreasOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
