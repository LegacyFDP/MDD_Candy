import { useEffect, useState } from 'react'
import {
  useGetAssets, useGetFetes, useGetWithdrawals,
  useBookAsset, useConvertBookingToOut, useWithdrawAsset, useReturnAsset, useGetUsers
} from '../hooks/backend/fete'
import { Button } from '../lib/shadcn/button'
import { Input } from '../lib/shadcn/input'
import { Label } from '../lib/shadcn/label'
import { Badge } from '../lib/shadcn/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../lib/shadcn/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../lib/shadcn/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../lib/shadcn/select'
import { ArrowUpFromLine, ArrowDownToLine, History } from 'lucide-react'
import type { AppUser } from './Login'

interface Props { currentUser: AppUser }

type Asset = {
  id: number
  name: string
  category: string
  quantity_total: number
  quantity_available: number
  quantity_booked?: number
}
type Fete = { id: number; name: string; status: string }
type Withdrawal = {
  id: number; asset_name: string; quantity: number; quantity_total: number; store_name?: string
  withdrawn_by_name: string; withdrawn_at: string
  returned_by_name?: string; returned_at?: string
  fete_name?: string; status: string; notes?: string; asset_id: number
}
type FeteUser = { id: number; name: string; role: string }

export default function WithdrawalsPage({ currentUser }: Props) {
  const { data: assetsRaw, trigger: loadAssets } = useGetAssets()
  const { data: fetesRaw, trigger: loadFetes } = useGetFetes()
  const { data: outRaw, trigger: loadOut } = useGetWithdrawals()
  const { data: bookedRaw, trigger: loadBooked } = useGetWithdrawals()
  const { data: historyRaw, trigger: loadHistory } = useGetWithdrawals()
  const { data: usersRaw, trigger: loadUsers } = useGetUsers()
  const { trigger: doBook, loading: booking } = useBookAsset()
  const { trigger: doConvertBooking, loading: convertingBooking } = useConvertBookingToOut()
  const { trigger: doWithdraw, loading: withdrawing } = useWithdrawAsset()
  const { trigger: doReturn, loading: returning } = useReturnAsset()

  const assets = (assetsRaw ?? []) as Asset[]
  const fetes = (fetesRaw ?? []) as Fete[]
  const outItems = (outRaw ?? []) as Withdrawal[]
  const bookedItems = (bookedRaw ?? []) as Withdrawal[]
  const history = (historyRaw ?? []) as Withdrawal[]
  const users = (usersRaw ?? []) as FeteUser[]
  const schedulableFetes = fetes.filter(f => f.status === 'planned' || f.status === 'active')
  const canChangeAssetStatus = currentUser.role === 'admin' || currentUser.role === 'store keeper'

  // Booking form
  const [bOpen, setBOpen] = useState(false)
  const [bAssetId, setBAssetId] = useState('')
  const [bFeteId, setBFeteId] = useState('')
  const [bQty, setBQty] = useState(1)
  const [bUserId, setBUserId] = useState(String(currentUser.id))
  const [bNotes, setBNotes] = useState('')
  const [bError, setBError] = useState('')

  // Withdraw form
  const [wOpen, setWOpen] = useState(false)
  const [wAssetId, setWAssetId] = useState('')
  const [wFeteId, setWFeteId] = useState('')
  const [wQty, setWQty] = useState(1)
  const [wUserId, setWUserId] = useState(String(currentUser.id))
  const [wNotes, setWNotes] = useState('')
  const [wError, setWError] = useState('')

  // Return form
  const [rOpen, setROpen] = useState(false)
  const [rWithdrawalId, setRWithdrawalId] = useState<number | null>(null)
  const [rItem, setRItem] = useState<Withdrawal | null>(null)
  const [rUserId, setRUserId] = useState(String(currentUser.id))
  const [rNotes, setRNotes] = useState('')
  const [rError, setRError] = useState('')

  const [tab, setTab] = useState('out')

  async function refreshPageData(options?: { includeHistory?: boolean }) {
    const includeHistory = options?.includeHistory ?? false
    const requests: Array<Promise<unknown>> = [
      loadAssets({}),
      loadFetes({}),
      loadOut({ status: 'out' }),
      loadBooked({ status: 'booked' }),
      loadUsers({}),
    ]

    if (includeHistory) {
      requests.push(loadHistory({}))
    }

    await Promise.all(requests)
  }

  useEffect(() => {
    void refreshPageData()
  }, [])

  useEffect(() => {
    if (tab === 'history') void loadHistory({})
  }, [tab])

  const selectedAsset = assets.find(a => a.id === parseInt(wAssetId))
  const selectedBookedAsset = assets.find(a => a.id === parseInt(bAssetId))

  async function handleBook() {
    setBError('')
    if (!bAssetId || !bFeteId) {
      setBError('Please select an asset and event')
      return
    }

    try {
      await doBook({
        asset_id: parseInt(bAssetId),
        fete_id: parseInt(bFeteId),
        quantity: bQty,
        booked_by: parseInt(bUserId),
        notes: bNotes,
      })
      setBOpen(false)
      await refreshPageData({ includeHistory: true })
    } catch (e) {
      setBError((e as Error).message)
    }
  }

  async function handleConvertBookingToOut(item: Withdrawal) {
    const confirmed = confirm(
      `Convert booking to out for ${item.asset_name} (qty ${item.quantity})? This will reduce available stock now.`,
    )
    if (!confirmed) return

    try {
      await doConvertBooking({
        withdrawal_id: item.id,
        withdrawn_by: currentUser.id,
        notes: '',
      })
      await refreshPageData({ includeHistory: true })
    } catch (e) {
      setBError((e as Error).message)
      setTab('booked')
    }
  }

  async function handleWithdraw() {
    setWError('')
    try {
      await doWithdraw({
        asset_id: parseInt(wAssetId),
        fete_id: wFeteId ? parseInt(wFeteId) : null,
        quantity: wQty,
        withdrawn_by: parseInt(wUserId),
        notes: wNotes
      })
      setWOpen(false)
      await refreshPageData({ includeHistory: true })
    } catch (e) {
      setWError((e as Error).message)
    }
  }

  function openReturn(w: Withdrawal) {
    setRWithdrawalId(w.id)
    setRItem(w)
    setRUserId(String(currentUser.id))
    setRNotes('')
    setRError('')
    setROpen(true)
  }

  async function handleReturn() {
    if (!rWithdrawalId) return
    setRError('')
    try {
      await doReturn({
        withdrawal_id: rWithdrawalId,
        returned_by: parseInt(rUserId),
        notes: rNotes
      })
      setROpen(false)
      await refreshPageData({ includeHistory: true })
    } catch (e) {
      setRError((e as Error).message)
    }
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Withdrawals</h1>
          <p className="text-muted-foreground text-sm">Check items out of and back into the store</p>
        </div>
        <div className="flex items-center gap-2">
          {canChangeAssetStatus && (
            <>
              <Button
                variant="outline"
                onClick={() => { setBOpen(true); setBError('') }}
                className="flex items-center gap-2"
              >
                Book Item
              </Button>
              <Button onClick={() => { setWOpen(true); setWError('') }}
                className="flex items-center gap-2">
                <ArrowUpFromLine className="w-4 h-4" /> Withdraw Item
              </Button>
            </>
          )}
        </div>
      </div>

      {!canChangeAssetStatus && (
        <p className="text-sm text-muted-foreground">
          View-only mode: only admin and store keeper can book, withdraw, return, or convert assets.
        </p>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="out">
            <ArrowUpFromLine className="w-4 h-4 mr-1" />
            Out ({outItems.length})
          </TabsTrigger>
          <TabsTrigger value="booked">
            Booked ({bookedItems.length})
          </TabsTrigger>
          <TabsTrigger value="history">
            <History className="w-4 h-4 mr-1" />
            Full History
          </TabsTrigger>
        </TabsList>

        {/* Items currently out */}
        <TabsContent value="out" className="mt-4">
          {outItems.length === 0 ? (
            <p className="text-muted-foreground">All items are back in store.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {outItems.map(w => (
                <div key={w.id} className="border rounded-lg p-4 bg-card text-card-foreground space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium">
                        {w.asset_name}
                        {w.store_name && <span className="text-muted-foreground font-normal"> ({w.store_name})</span>}
                      </p>
                      <p className="text-sm text-muted-foreground">Qty: {w.quantity} of {w.quantity_total}</p>
                    </div>
                    <Badge variant="secondary">Out</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground space-y-0.5">
                    <p>By: <span className="text-foreground">{w.withdrawn_by_name}</span></p>
                    <p>When: {new Date(w.withdrawn_at).toLocaleString('en-GB')}</p>
                    {w.fete_name && <p>Fete: {w.fete_name}</p>}
                    {w.notes && <p>Note: {w.notes}</p>}
                  </div>
                  {canChangeAssetStatus && (
                    <Button size="sm" variant="outline" onClick={() => openReturn(w)}
                      className="w-full flex items-center justify-center gap-1">
                      <ArrowDownToLine className="w-3 h-3" /> Return to Store
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Items booked for future events */}
        <TabsContent value="booked" className="mt-4">
          {bookedItems.length === 0 ? (
            <p className="text-muted-foreground">No booked items.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {bookedItems.map(w => (
                <div key={w.id} className="border rounded-lg p-4 bg-card text-card-foreground space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium">
                        {w.asset_name}
                        {w.store_name && <span className="text-muted-foreground font-normal"> ({w.store_name})</span>}
                      </p>
                      <p className="text-sm text-muted-foreground">Qty: {w.quantity} of {w.quantity_total}</p>
                    </div>
                    <Badge variant="outline">Booked</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground space-y-0.5">
                    <p>By: <span className="text-foreground">{w.withdrawn_by_name}</span></p>
                    <p>When: {new Date(w.withdrawn_at).toLocaleString('en-GB')}</p>
                    {w.fete_name && <p>Fete: {w.fete_name}</p>}
                    {w.notes && <p>Note: {w.notes}</p>}
                  </div>
                  {canChangeAssetStatus && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={convertingBooking}
                      onClick={() => void handleConvertBookingToOut(w)}
                      className="w-full"
                    >
                      {convertingBooking ? 'Converting…' : 'Convert to Out'}
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* History */}
        <TabsContent value="history" className="mt-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="text-left py-2 pr-4 font-medium">Asset</th>
                  <th className="text-center py-2 pr-4 font-medium">Qty</th>
                  <th className="text-left py-2 pr-4 font-medium">Withdrawn By</th>
                  <th className="text-left py-2 pr-4 font-medium">Withdrawn At</th>
                  <th className="text-left py-2 pr-4 font-medium">Returned By</th>
                  <th className="text-left py-2 pr-4 font-medium">Returned At</th>
                  <th className="text-left py-2 pr-4 font-medium">Fete</th>
                  <th className="text-center py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {history.map(w => (
                  <tr key={w.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                    <td className="py-2 pr-4 font-medium">
                      {w.asset_name}
                      {w.store_name && <span className="text-muted-foreground font-normal"> ({w.store_name})</span>}
                    </td>
                    <td className="py-2 pr-4 text-center">{w.quantity} of {w.quantity_total}</td>
                    <td className="py-2 pr-4">{w.withdrawn_by_name}</td>
                    <td className="py-2 pr-4 text-muted-foreground">
                      {new Date(w.withdrawn_at).toLocaleString('en-GB')}
                    </td>
                    <td className="py-2 pr-4">{w.returned_by_name ?? '—'}</td>
                    <td className="py-2 pr-4 text-muted-foreground">
                      {w.returned_at ? new Date(w.returned_at).toLocaleString('en-GB') : '—'}
                    </td>
                    <td className="py-2 pr-4 text-muted-foreground">{w.fete_name ?? '—'}</td>
                    <td className="py-2 text-center">
                      {w.status === 'out' && canChangeAssetStatus ? (
                        <Button size="sm" variant="outline"
                          className="flex items-center gap-1 text-xs"
                          onClick={() => openReturn(w)}>
                          <ArrowDownToLine className="w-3 h-3" /> Return
                        </Button>
                      ) : w.status === 'booked' && canChangeAssetStatus ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex items-center gap-1 text-xs"
                          disabled={convertingBooking}
                          onClick={() => void handleConvertBookingToOut(w)}
                        >
                          Convert to Out
                        </Button>
                      ) : w.status === 'booked' ? (
                        <Badge variant="outline">booked</Badge>
                      ) : w.status === 'out' ? (
                        <Badge variant="secondary">out</Badge>
                      ) : (
                        <Badge variant="default">returned</Badge>
                      )}
                    </td>
                  </tr>
                ))}
                {history.length === 0 && (
                  <tr><td colSpan={8} className="py-4 text-muted-foreground text-center">No history yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>

      {/* Withdraw Dialog */}
      <Dialog open={wOpen && canChangeAssetStatus} onOpenChange={setWOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Withdraw Item from Store</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Asset</Label>
              <Select {...(wAssetId ? { value: wAssetId } : {})} onValueChange={v => { setWAssetId(v); setWQty(1) }}>
                <SelectTrigger><SelectValue placeholder="Select asset…" /></SelectTrigger>
                <SelectContent>
                  {assets.map(a => (
                    <SelectItem key={a.id} value={String(a.id)} disabled={a.quantity_available === 0}>
                      {a.name} ({a.quantity_available} available)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Quantity {selectedAsset && `(max ${selectedAsset.quantity_available})`}</Label>
              <Input type="number" min={1} max={selectedAsset?.quantity_available ?? 999}
                value={wQty} onChange={e => setWQty(parseInt(e.target.value) || 1)} />
            </div>
            <div className="space-y-1">
              <Label>Withdrawn By</Label>
              <Select value={wUserId} onValueChange={setWUserId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {users.map(u => (
                    <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Fete (optional)</Label>
              <Select {...(wFeteId ? { value: wFeteId } : {})} onValueChange={setWFeteId}>
                <SelectTrigger><SelectValue placeholder="No fete (general use)" /></SelectTrigger>
                <SelectContent>
                  {fetes.map(f => (
                    <SelectItem key={f.id} value={String(f.id)}>{f.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Notes</Label>
              <Input value={wNotes} onChange={e => setWNotes(e.target.value)} />
            </div>
            {wError && <p className="text-destructive text-sm">{wError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWOpen(false)}>Cancel</Button>
            <Button onClick={handleWithdraw} disabled={withdrawing || !wAssetId}>
              {withdrawing ? 'Withdrawing…' : 'Confirm Withdrawal'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Return Dialog */}
      <Dialog open={rOpen && canChangeAssetStatus} onOpenChange={setROpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Return Item to Store</DialogTitle>
          </DialogHeader>
          {rItem && (
            <div className="px-1 py-2 rounded-md bg-muted text-sm">
              <span className="font-medium">{rItem.asset_name}</span>
              <span className="text-muted-foreground"> × {rItem.quantity}</span>
              <span className="text-muted-foreground"> · withdrawn by {rItem.withdrawn_by_name}</span>
            </div>
          )}
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Returned By</Label>
              <Select value={rUserId} onValueChange={setRUserId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {users.map(u => (
                    <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Notes (optional)</Label>
              <Input value={rNotes} onChange={e => setRNotes(e.target.value)}
                placeholder="Any damage, missing parts, etc." />
            </div>
            {rError && <p className="text-destructive text-sm">{rError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setROpen(false)}>Cancel</Button>
            <Button onClick={handleReturn} disabled={returning}>
              {returning ? 'Returning…' : 'Confirm Return'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Booking Dialog */}
      <Dialog open={bOpen && canChangeAssetStatus} onOpenChange={setBOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Book Item for a Future Event</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Asset</Label>
              <Select {...(bAssetId ? { value: bAssetId } : {})} onValueChange={v => { setBAssetId(v); setBQty(1) }}>
                <SelectTrigger><SelectValue placeholder="Select asset…" /></SelectTrigger>
                <SelectContent>
                  {assets.map(a => (
                    <SelectItem key={a.id} value={String(a.id)}>
                      {a.name} ({a.quantity_available} available{a.quantity_booked ? `, ${a.quantity_booked} booked` : ''})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Event</Label>
              <Select {...(bFeteId ? { value: bFeteId } : {})} onValueChange={setBFeteId}>
                <SelectTrigger><SelectValue placeholder="Select event…" /></SelectTrigger>
                <SelectContent>
                  {schedulableFetes.map(f => (
                    <SelectItem key={f.id} value={String(f.id)}>{f.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Quantity {selectedBookedAsset && `(max ${selectedBookedAsset.quantity_total})`}</Label>
              <Input type="number" min={1} max={selectedBookedAsset?.quantity_total ?? 999}
                value={bQty} onChange={e => setBQty(parseInt(e.target.value) || 1)} />
            </div>
            <div className="space-y-1">
              <Label>Booked By</Label>
              <Select value={bUserId} onValueChange={setBUserId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {users.map(u => (
                    <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Notes</Label>
              <Input value={bNotes} onChange={e => setBNotes(e.target.value)} />
            </div>
            {bError && <p className="text-destructive text-sm">{bError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBOpen(false)}>Cancel</Button>
            <Button onClick={handleBook} disabled={booking || !bAssetId || !bFeteId}>
              {booking ? 'Booking…' : 'Confirm Booking'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
