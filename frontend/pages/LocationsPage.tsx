import { useEffect, useState } from 'react'
import { useGetLocations, useSaveLocation } from '../hooks/backend/fete'
import { Button } from '../lib/shadcn/button'
import { Input } from '../lib/shadcn/input'
import { Label } from '../lib/shadcn/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../lib/shadcn/dialog'
import { Plus, Pencil, MapPin } from 'lucide-react'
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
}

export default function LocationsPage({ currentUser }: Props) {
  const { data: locationsRaw, trigger: loadLocations } = useGetLocations()
  const { trigger: saveLocation, loading: saving } = useSaveLocation()

  const locations = (locationsRaw ?? []) as Location[]

  const [open, setOpen] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [saveError, setSaveError] = useState('')
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

  useEffect(() => { void loadLocations({}) }, [])

  const isAdmin = currentUser.role === 'admin'

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

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {locations.map(loc => (
          <div key={loc.id} className="border rounded-lg p-4 bg-card text-card-foreground flex items-start gap-3">
            <div className="bg-primary/10 p-2 rounded-full flex-shrink-0">
              <MapPin className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium">{loc.name}</p>
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
              <Button size="sm" variant="outline" onClick={() => openEdit(loc)}
                aria-label="Edit location">
                <Pencil className="w-3 h-3" />
              </Button>
            )}
          </div>
        ))}
        {locations.length === 0 && (
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
    </div>
  )
}
