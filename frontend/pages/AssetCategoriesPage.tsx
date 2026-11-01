import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  useGetAssetCategories, useSaveAssetCategory, useDeleteAssetCategory,
} from '../hooks/backend/fete'
import { Button } from '../lib/shadcn/button'
import { Input } from '../lib/shadcn/input'
import { Label } from '../lib/shadcn/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../lib/shadcn/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '../lib/shadcn/select'
import { Tooltip, TooltipContent, TooltipTrigger } from '../lib/shadcn/tooltip'
import { Plus, Pencil, Trash2, Tag, Search, Package } from 'lucide-react'
import type { AppUser } from './Login'

interface Props { currentUser: AppUser }

type AssetCategory = { id: number; name: string; asset_count: number }

export default function AssetCategoriesPage({ currentUser }: Props) {
  const { data: categoriesRaw, trigger: loadCategories, loading, error: loadError } = useGetAssetCategories()
  const { trigger: saveCategory, loading: saving } = useSaveAssetCategory()
  const { trigger: deleteCategory, loading: deleting } = useDeleteAssetCategory()

  const categories = (categoriesRaw ?? []) as AssetCategory[]

  const [search, setSearch] = useState('')

  const [editOpen, setEditOpen] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [name, setName] = useState('')
  const [saveError, setSaveError] = useState('')

  const [deleteTarget, setDeleteTarget] = useState<AssetCategory | null>(null)
  const [moveToId, setMoveToId] = useState('')
  const [deleteError, setDeleteError] = useState('')

  useEffect(() => {
    void loadCategories({})
  }, [])

  const isAdmin = currentUser.role === 'admin'

  const query = search.trim().toLowerCase()
  const visibleCategories = categories.filter(category => category.name.toLowerCase().includes(query))
  const totalAssets = categories.reduce((sum, category) => sum + category.asset_count, 0)

  function openNew() {
    setEditId(null)
    setName('')
    setSaveError('')
    setEditOpen(true)
  }

  function openEdit(category: AssetCategory) {
    setEditId(category.id)
    setName(category.name)
    setSaveError('')
    setEditOpen(true)
  }

  async function handleSave() {
    setSaveError('')
    try {
      await saveCategory({ ...(editId ? { id: editId } : {}), name })
      setEditOpen(false)
      void loadCategories({})
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Failed to save category')
    }
  }

  function openDelete(category: AssetCategory) {
    setDeleteTarget(category)
    setMoveToId('')
    setDeleteError('')
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleteError('')
    try {
      await deleteCategory({
        id: deleteTarget.id,
        ...(deleteTarget.asset_count > 0 ? { move_to_id: parseInt(moveToId) } : {}),
      })
      setDeleteTarget(null)
      void loadCategories({})
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'Failed to delete category')
    }
  }

  const trimmedName = name.trim()
  const duplicate = categories.some(
    category => category.id !== editId && category.name.toLowerCase() === trimmedName.toLowerCase()
  )
  const moveTargets = categories.filter(category => category.id !== deleteTarget?.id)
  const moveToName = moveTargets.find(category => String(category.id) === moveToId)?.name

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Asset Categories</h1>
          <p className="text-muted-foreground text-sm">
            {categories.length} categor{categories.length !== 1 ? 'ies' : 'y'} covering {totalAssets} asset{totalAssets !== 1 ? 's' : ''}
          </p>
        </div>
        {isAdmin && (
          <Button onClick={openNew} className="flex items-center gap-2">
            <Plus className="w-4 h-4" /> Add Category
          </Button>
        )}
      </div>

      <div className="relative max-w-xl">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search categories"
          className="pl-9"
          aria-label="Search asset categories"
        />
      </div>

      {loadError && (
        <p className="text-sm text-destructive" role="alert">
          Unable to load Asset Categories: {loadError.message}
        </p>
      )}

      <div className="border rounded-lg bg-card text-card-foreground divide-y">
        {visibleCategories.map(category => (
          <div key={category.id} className="flex items-center gap-3 px-4 py-1">
            <Tag className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
            <span className="flex-1 min-w-0 text-sm font-medium truncate">{category.name}</span>
            <Link
              to="/assets"
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <Package className="w-3.5 h-3.5" />
              {category.asset_count} asset{category.asset_count !== 1 ? 's' : ''}
            </Link>
            {isAdmin && (
              <div className="flex items-center gap-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(category)} aria-label={`Rename ${category.name}`}>
                      <Pencil className="w-3 h-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Rename {category.name}</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => openDelete(category)}
                      aria-label={`Delete ${category.name}`}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {category.asset_count > 0 ? `Delete or merge ${category.name}` : `Delete ${category.name}`}
                  </TooltipContent>
                </Tooltip>
              </div>
            )}
          </div>
        ))}
        {categories.length > 0 && visibleCategories.length === 0 && (
          <p className="text-muted-foreground text-sm px-4 py-3">No categories match the search.</p>
        )}
        {!loading && !loadError && categories.length === 0 && (
          <p className="text-muted-foreground text-sm px-4 py-3">No categories defined yet.</p>
        )}
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editId ? 'Rename Category' : 'Add Category'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-1">
            <Label>Category Name</Label>
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && trimmedName && !duplicate && !saving) void handleSave()
              }}
              placeholder="e.g. Shelter"
              autoFocus
            />
            {duplicate && (
              <p className="text-xs text-destructive">
                A category with this name already exists. To combine them, delete this one and move its assets there.
              </p>
            )}
            {editId && !duplicate && (
              <p className="text-xs text-muted-foreground">Every asset in this category will show the new name.</p>
            )}
          </div>
          {saveError && <p className="text-sm text-destructive">{saveError}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={() => void handleSave()} disabled={saving || !trimmedName || duplicate}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteTarget !== null} onOpenChange={isOpen => { if (!isOpen) setDeleteTarget(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete “{deleteTarget?.name}”</DialogTitle>
          </DialogHeader>
          {deleteTarget && deleteTarget.asset_count > 0 ? (
            <div className="space-y-2">
              <p className="text-sm">
                {deleteTarget.asset_count} asset{deleteTarget.asset_count !== 1 ? 's are' : ' is'} in this category.
                Choose a category to move {deleteTarget.asset_count !== 1 ? 'them' : 'it'} into before deleting.
              </p>
              <Label>Move assets to</Label>
              <Select value={moveToId} onValueChange={setMoveToId}>
                <SelectTrigger><SelectValue placeholder="Select category…" /></SelectTrigger>
                <SelectContent>
                  {moveTargets.map(category => (
                    <SelectItem key={category.id} value={String(category.id)}>
                      {category.name} ({category.asset_count})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {moveTargets.length === 0 && (
                <p className="text-xs text-muted-foreground">Add another category first so these assets have somewhere to go.</p>
              )}
            </div>
          ) : (
            <p className="text-sm">No assets use this category. This cannot be undone.</p>
          )}
          {deleteError && <p className="text-sm text-destructive">{deleteError}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => void handleDelete()}
              disabled={deleting || (Boolean(deleteTarget?.asset_count) && !moveToId)}
            >
              {deleting
                ? 'Deleting…'
                : moveToName ? `Move to ${moveToName} & Delete` : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
