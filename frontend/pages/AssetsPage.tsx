import { useEffect, useState } from 'react'
import {
  useGetAssets, useGetLocations, useSaveAsset, useDeleteAsset,
  useGetAssetCategories, useSaveAssetCategory, useDeleteAssetCategory
} from '../hooks/backend/fete'
import { Button } from '../lib/shadcn/button'
import { Input } from '../lib/shadcn/input'
import { Label } from '../lib/shadcn/label'
import { Badge } from '../lib/shadcn/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '../lib/shadcn/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '../lib/shadcn/select'
import { Tabs, TabsList, TabsTrigger } from '../lib/shadcn/tabs'
import { Plus, Pencil, Trash2, MapPin, Package, LayoutGrid, Tag, Settings2 } from 'lucide-react'
import type { AppUser } from './Login'

interface Props { currentUser: AppUser }

type Asset = {
  id: number; name: string; category: string
  quantity_total: number; quantity_available: number
  quantity_booked?: number
  location_id: number | null; location_name: string | null; notes: string
}

type Location = { id: number; name: string; description: string }
type AssetCategory = { id: number; name: string }

const CUSTOM_CATEGORY = '__custom__'

const emptyForm = (): Omit<Asset, 'id' | 'quantity_available' | 'location_name'> => ({
  name: '', category: 'Equipment', quantity_total: 1, location_id: null, notes: ''
})

function AvailabilityBadge({ available, total }: { available: number; total: number }) {
  return (
    <Badge
      variant={available === 0 ? 'destructive' : available < 3 ? 'secondary' : 'default'}
    >
      {available}/{total}
    </Badge>
  )
}

function AssetCard({
  asset,
  isAdmin,
  showCategory,
  showLocation,
  onEdit,
  onDelete,
}: {
  asset: Asset
  isAdmin: boolean
  showCategory: boolean
  showLocation: boolean
  onEdit: (a: Asset) => void
  onDelete: (id: number) => void
}) {
  return (
    <div className="border rounded-lg p-4 bg-card text-card-foreground space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Package className="w-4 h-4 text-primary flex-shrink-0" />
          <span className="font-medium truncate">{asset.name}</span>
        </div>
        <div className="flex items-center gap-1">
          {Boolean(asset.quantity_booked && asset.quantity_booked > 0) && (
            <Badge variant="outline">Booked {asset.quantity_booked}</Badge>
          )}
          <AvailabilityBadge available={asset.quantity_available} total={asset.quantity_total} />
        </div>
      </div>

      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
        {asset.quantity_total <= 1 && (
          <Badge variant="outline">Unique</Badge>
        )}
        {showCategory && (
          <span className="flex items-center gap-1">
            <Tag className="w-3 h-3" /> {asset.category}
          </span>
        )}
        {showLocation && asset.location_name && (
          <span className="flex items-center gap-1">
            <MapPin className="w-3 h-3" /> {asset.location_name}
          </span>
        )}
      </div>

      {asset.notes && (
        <p className="text-xs text-muted-foreground line-clamp-2">{asset.notes}</p>
      )}

      {isAdmin && (
        <div className="flex gap-2 pt-1">
          <Button size="sm" variant="outline" onClick={() => onEdit(asset)}
            className="flex items-center gap-1">
            <Pencil className="w-3 h-3" /> Edit
          </Button>
          <Button size="sm" variant="outline"
            className="text-destructive hover:text-destructive"
            onClick={() => onDelete(asset.id)}
            aria-label="Delete asset">
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      )}
    </div>
  )
}

function GroupSection({
  title,
  subtitle,
  icon,
  assets,
  isAdmin,
  showCategory,
  showLocation,
  onEdit,
  onDelete,
}: {
  title: string
  subtitle?: string | undefined
  icon: React.ReactNode
  assets: Asset[]
  isAdmin: boolean
  showCategory: boolean
  showLocation: boolean
  onEdit: (a: Asset) => void
  onDelete: (id: number) => void
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        {icon}
        <div>
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        <span className="ml-auto text-xs text-muted-foreground bg-muted rounded-full px-2 py-0.5">
          {assets.length} item{assets.length !== 1 ? 's' : ''}
        </span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {assets.map(asset => (
          <AssetCard
            key={asset.id}
            asset={asset}
            isAdmin={isAdmin}
            showCategory={showCategory}
            showLocation={showLocation}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
      </div>
    </div>
  )
}

export default function AssetsPage({ currentUser }: Props) {
  const { data: assetsRaw, trigger: loadAssets } = useGetAssets()
  const { data: locationsRaw, trigger: loadLocations } = useGetLocations()
  const { data: categoriesRaw, trigger: loadCategories } = useGetAssetCategories()
  const { trigger: saveAsset, loading: saving } = useSaveAsset()
  const { trigger: deleteAsset } = useDeleteAsset()
  const { trigger: saveCategory, loading: savingCategory } = useSaveAssetCategory()
  const { trigger: deleteCategory } = useDeleteAssetCategory()

  const assets = (assetsRaw ?? []) as Asset[]
  const locations = (locationsRaw ?? []) as Location[]
  const categories = (categoriesRaw ?? []) as AssetCategory[]

  const [groupBy, setGroupBy] = useState<'category' | 'location'>('location')
  const [filterValue, setFilterValue] = useState('All')
  const [search, setSearch] = useState('')

  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<Partial<Omit<Asset, 'quantity_available' | 'location_name'>>>(emptyForm())
  const [editId, setEditId] = useState<number | null>(null)
  const [saveError, setSaveError] = useState('')
  const [categoriesOpen, setCategoriesOpen] = useState(false)
  const [categoryName, setCategoryName] = useState('')
  const [categoryEditId, setCategoryEditId] = useState<number | null>(null)
  const [categoryError, setCategoryError] = useState('')

  useEffect(() => {
    void loadAssets({})
    void loadLocations({})
    void loadCategories({})
  }, [])

  // Reset filter when switching group mode
  function switchGroupBy(mode: 'category' | 'location') {
    setGroupBy(mode)
    setFilterValue('All')
  }

  function openNew() {
    setForm({ ...emptyForm(), category: categories[0]?.name ?? '' })
    setEditId(null)
    setSaveError('')
    setOpen(true)
  }

  function openEdit(a: Asset) {
    setForm({
      name: a.name, category: a.category, quantity_total: a.quantity_total,
      location_id: a.location_id, notes: a.notes
    })
    setEditId(a.id)
    setSaveError('')
    setOpen(true)
  }

  async function handleSave() {
    setSaveError('')
    try {
      await saveAsset({
        ...(editId ? { id: editId } : {}),
        name: form.name ?? '',
        category: form.category ?? '',
        quantity_total: form.quantity_total ?? 1,
        location_id: form.location_id ?? null,
        notes: form.notes ?? ''
      })
      setOpen(false)
      void loadAssets({})
    } catch (error) {
      setSaveError((error as Error).message)
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this asset?')) return
    await deleteAsset({ id })
    void loadAssets({})
  }

  function openNewCategory() {
    setCategoryEditId(null)
    setCategoryName('')
    setCategoryError('')
  }

  function openEditCategory(category: AssetCategory) {
    setCategoryEditId(category.id)
    setCategoryName(category.name)
    setCategoryError('')
  }

  async function handleSaveCategory() {
    setCategoryError('')
    try {
      await saveCategory({ ...(categoryEditId ? { id: categoryEditId } : {}), name: categoryName })
      openNewCategory()
      void loadCategories({})
      void loadAssets({})
    } catch (error) {
      setCategoryError((error as Error).message)
    }
  }

  async function handleDeleteCategory(category: AssetCategory) {
    if (!confirm(`Delete the ${category.name} category?`)) return
    setCategoryError('')
    try {
      await deleteCategory({ id: category.id })
      if (categoryEditId === category.id) openNewCategory()
      void loadCategories({})
    } catch (error) {
      setCategoryError((error as Error).message)
    }
  }

  // Build filter pill options
  const categoryPills = ['All', ...Array.from(new Set(assets.map(a => a.category))).sort()]
  const locationPills = [
    'All',
    ...locations.map(l => l.name),
    ...(assets.some(a => !a.location_id) ? ['Unassigned'] : [])
  ]
  const pills = groupBy === 'category' ? categoryPills : locationPills

  const extraCategories = Array.from(
    new Set(
      assets
        .map(a => a.category.trim())
        .filter(category => category && !CATEGORIES.includes(category))
    )
  ).sort((a, b) => a.localeCompare(b))

  const categoryOptions = [...CATEGORIES, ...extraCategories]
  const currentCategory = (form.category ?? '').trim()
  const isCustomCategory = Boolean(currentCategory) && !categoryOptions.includes(currentCategory)

  // Apply search + filter
  const filtered = assets
    .filter(a => {
      if (groupBy === 'category') return filterValue === 'All' || a.category === filterValue
      if (filterValue === 'Unassigned') return !a.location_id
      return filterValue === 'All' || a.location_name === filterValue
    })
    .filter(a => a.name.toLowerCase().includes(search.toLowerCase()))

  // Group filtered assets
  type Group = { key: string; title: string; subtitle?: string | undefined; assets: Asset[] }
  let groups: Group[] = []

  if (groupBy === 'category') {
    const map = filtered.reduce<Record<string, Asset[]>>((acc, a) => {
      if (!acc[a.category]) acc[a.category] = []
      acc[a.category]!.push(a)
      return acc
    }, {})
    groups = Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([cat, items]) => ({ key: cat, title: cat, assets: items }))
  } else {
    // Group by location
    const locMap = new Map(locations.map(l => [String(l.id), l]))
    const byLoc: Record<string, Asset[]> = {}

    for (const a of filtered) {
      const key = a.location_id ? String(a.location_id) : '__unassigned__'
      if (!byLoc[key]) byLoc[key] = []
      byLoc[key]!.push(a)
    }

    // Ordered: known locations first (sorted by name), then unassigned
    const sortedLocIds = locations.map(l => String(l.id))
    const orderedKeys = [
      ...sortedLocIds.filter(k => byLoc[k]),
      ...Object.keys(byLoc).filter(k => k === '__unassigned__')
    ]

    groups = orderedKeys.map(key => {
      if (key === '__unassigned__') {
        return { key, title: 'Unassigned', subtitle: 'No storage location set', assets: byLoc[key]! }
      }
      const loc = locMap.get(key)
      const sub: string | undefined = loc?.description || undefined
      return {
        key,
        title: loc?.name ?? 'Unknown',
        ...(sub !== undefined ? { subtitle: sub } : {}),
        assets: byLoc[key]!
      }
    })
  }

  const isAdmin = currentUser.role === 'admin'

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Store Assets</h1>
          <p className="text-muted-foreground text-sm">Track all items in the charity store</p>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => setCategoriesOpen(true)} aria-label="Manage categories">
              <Settings2 className="w-4 h-4" />
            </Button>
            <Button onClick={openNew} className="flex items-center gap-2">
              <Plus className="w-4 h-4" /> Add Asset
            </Button>
          </div>
        )}
      </div>

      {/* Group-by toggle + search */}
      <div className="flex flex-wrap items-center gap-3">
        <Tabs value={groupBy} onValueChange={v => switchGroupBy(v as 'category' | 'location')}>
          <TabsList>
            <TabsTrigger value="location" className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5" /> By Location
            </TabsTrigger>
            <TabsTrigger value="category" className="flex items-center gap-1.5">
              <LayoutGrid className="w-3.5 h-3.5" /> By Category
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <Input
          placeholder="Search assets…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="max-w-xs"
        />
      </div>

      {/* Filter pills */}
      <div className="flex gap-2 flex-wrap">
        {pills.map(pill => (
          <button
            key={pill}
            onClick={() => setFilterValue(pill)}
            className={`px-3 py-1 rounded-full text-sm border transition-colors ${
              filterValue === pill
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background text-muted-foreground border-border hover:border-primary'
            }`}
          >
            {pill}
          </button>
        ))}
      </div>

      {/* Groups */}
      <div className="space-y-8">
        {groups.map(g => (
          <GroupSection
            key={g.key}
            title={g.title}
            {...(g.subtitle !== undefined ? { subtitle: g.subtitle } : {})}
            icon={
              groupBy === 'location'
                ? <div className="bg-primary/10 p-1.5 rounded-full">
                    <MapPin className="w-4 h-4 text-primary" />
                  </div>
                : <div className="bg-muted p-1.5 rounded-full">
                    <Tag className="w-4 h-4 text-muted-foreground" />
                  </div>
            }
            assets={g.assets}
            isAdmin={isAdmin}
            showCategory={groupBy === 'location'}
            showLocation={groupBy === 'category'}
            onEdit={openEdit}
            onDelete={handleDelete}
          />
        ))}
        {groups.length === 0 && (
          <p className="text-muted-foreground text-sm">No assets found.</p>
        )}
      </div>

      {/* Add / Edit Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editId ? 'Edit Asset' : 'Add New Asset'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Name</Label>
              <Input
                value={form.name ?? ''}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Category</Label>
              <Select
                value={isCustomCategory ? CUSTOM_CATEGORY : (currentCategory || 'Equipment')}
                onValueChange={v => setForm(f => ({
                  ...f,
                  category: v === CUSTOM_CATEGORY ? '' : v,
                }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
<<<<<<< HEAD
                  {categoryOptions.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  <SelectItem value={CUSTOM_CATEGORY}>+ Add new category</SelectItem>
=======
                  {categories.map(category => <SelectItem key={category.id} value={category.name}>{category.name}</SelectItem>)}
>>>>>>> main
                </SelectContent>
              </Select>
              {(isCustomCategory || form.category === '') && (
                <Input
                  placeholder="Enter new category"
                  value={form.category ?? ''}
                  onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                />
              )}
            </div>
            <div className="space-y-1">
              <Label>Total Quantity</Label>
              <Input
                type="number" min={1}
                value={form.quantity_total ?? 1}
                onChange={e => setForm(f => ({ ...f, quantity_total: parseInt(e.target.value) || 1 }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Store Location</Label>
              <Select
                value={form.location_id ? String(form.location_id) : '__none__'}
                onValueChange={v => setForm(f => ({
                  ...f,
                  location_id: v === '__none__' ? null : parseInt(v)
                }))}
              >
                <SelectTrigger><SelectValue placeholder="Select location…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— No location —</SelectItem>
                  {locations.map(l => (
                    <SelectItem key={l.id} value={String(l.id)}>{l.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Notes</Label>
              <Input
                value={form.notes ?? ''}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
<<<<<<< HEAD
            <Button onClick={handleSave} disabled={saving || !form.name || !(form.category ?? '').trim()}>
=======
            <Button onClick={handleSave} disabled={saving || !form.name || !form.category}>
>>>>>>> main
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
          {saveError && <p className="text-sm text-destructive">{saveError}</p>}
        </DialogContent>
      </Dialog>

      <Dialog open={categoriesOpen} onOpenChange={setCategoriesOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manage Categories</DialogTitle>
          </DialogHeader>
          <div className="flex gap-2">
            <Input value={categoryName} onChange={event => setCategoryName(event.target.value)} placeholder="Category name" />
            <Button onClick={handleSaveCategory} disabled={savingCategory || !categoryName.trim()}>
              {categoryEditId ? 'Save' : 'Add'}
            </Button>
          </div>
          {categoryError && <p className="text-sm text-destructive">{categoryError}</p>}
          <div className="space-y-1">
            {categories.map(category => (
              <div key={category.id} className="flex items-center gap-2 border-b py-2 last:border-0">
                <span className="flex-1 text-sm">{category.name}</span>
                <Button size="icon" variant="ghost" onClick={() => openEditCategory(category)} aria-label={`Edit ${category.name}`}>
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button size="icon" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => void handleDeleteCategory(category)} aria-label={`Delete ${category.name}`}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
