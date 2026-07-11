import { useEffect, useState } from 'react'
import { useGetLocations, useSaveLocation } from '../hooks/backend/fete'
import { Button } from '../lib/shadcn/button'
import { Input } from '../lib/shadcn/input'
import { Label } from '../lib/shadcn/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../lib/shadcn/dialog'
import { Plus, Pencil, MapPin } from 'lucide-react'
import type { AppUser } from './Login'

interface Props { currentUser: AppUser }

type Location = { id: number; name: string; description: string }

export default function LocationsPage({ currentUser }: Props) {
  const { data: locationsRaw, trigger: loadLocations } = useGetLocations()
  const { trigger: saveLocation, loading: saving } = useSaveLocation()

  const locations = (locationsRaw ?? []) as Location[]

  const [open, setOpen] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [form, setForm] = useState<Partial<Location>>({ name: '', description: '' })

  useEffect(() => { void loadLocations({}) }, [])

  const isAdmin = currentUser.role === 'admin'

  function openNew() {
    setForm({ name: '', description: '' })
    setEditId(null)
    setOpen(true)
  }

  function openEdit(l: Location) {
    setForm({ ...l })
    setEditId(l.id)
    setOpen(true)
  }

  async function handleSave() {
    await saveLocation({
      ...(editId ? { id: editId } : {}),
      name: form.name ?? '',
      description: form.description ?? ''
    })
    setOpen(false)
    void loadLocations({})
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.name}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
