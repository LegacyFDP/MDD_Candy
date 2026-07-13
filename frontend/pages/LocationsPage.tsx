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
  address_line1: string
  address_line2: string
  town_city: string
  county: string
  postcode: string
}

type PostcodeLookupResult = {
  postcode: string
  admin_district: string | null
  admin_county: string | null
  parish: string | null
  region: string | null
}

const UK_POSTCODE_REGEX = /^[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2}$/

function normalizePostcode(value: string): string {
  const compact = value.toUpperCase().replace(/\s+/g, '')
  if (compact.length <= 3) return compact
  return `${compact.slice(0, -3)} ${compact.slice(-3)}`
}

export default function LocationsPage({ currentUser }: Props) {
  const { data: locationsRaw, trigger: loadLocations } = useGetLocations()
  const { trigger: saveLocation, loading: saving } = useSaveLocation()

  const locations = (locationsRaw ?? []) as Location[]

  const [open, setOpen] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [saveError, setSaveError] = useState('')
  const [lookupLoading, setLookupLoading] = useState(false)
  const [lookupError, setLookupError] = useState('')
  const [lookupSuccess, setLookupSuccess] = useState('')
  const [form, setForm] = useState<Partial<Location>>({
    name: '',
    description: '',
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
    setLookupError('')
    setLookupSuccess('')
    setForm({
      name: '',
      description: '',
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
    setLookupError('')
    setLookupSuccess('')
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

  async function handlePostcodeLookup() {
    const compact = (form.postcode ?? '').toUpperCase().replace(/\s+/g, '')
    setLookupError('')
    setLookupSuccess('')

    if (!compact) {
      setLookupError('Enter a postcode first')
      return
    }

    if (!UK_POSTCODE_REGEX.test(compact)) {
      setLookupError('Enter a valid UK postcode to run lookup')
      return
    }

    setLookupLoading(true)
    try {
      const response = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(compact)}`)
      const body = (await response.json()) as {
        status: number
        result: PostcodeLookupResult | null
      }

      if (!response.ok || !body.result) {
        setLookupError('Postcode lookup failed')
        return
      }

      const townOrCity = body.result.admin_district || body.result.parish || form.town_city || ''
      const county = body.result.admin_county || body.result.region || form.county || ''

      setForm((current) => ({
        ...current,
        postcode: normalizePostcode(body.result?.postcode ?? compact),
        town_city: current.town_city || townOrCity,
        county: current.county || county,
      }))
      setLookupSuccess('Postcode found. Town/county suggested.')
    } catch {
      setLookupError('Unable to reach postcode service')
    } finally {
      setLookupLoading(false)
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
              <Label>Postcode (UK)</Label>
              <div className="flex gap-2">
                <Input value={form.postcode ?? ''}
                  onChange={e => {
                    setLookupError('')
                    setLookupSuccess('')
                    setForm(f => ({ ...f, postcode: e.target.value }))
                  }}
                  placeholder="e.g. SW1A 1AA" />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handlePostcodeLookup}
                  disabled={lookupLoading || !(form.postcode ?? '').trim()}
                >
                  {lookupLoading ? 'Looking up…' : 'Lookup'}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Optional helper: fills town/county from postcode data. You can still type manually.
              </p>
            </div>
            {lookupError && (
              <p className="text-sm text-red-600">{lookupError}</p>
            )}
            {lookupSuccess && (
              <p className="text-sm text-green-700">{lookupSuccess}</p>
            )}
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
