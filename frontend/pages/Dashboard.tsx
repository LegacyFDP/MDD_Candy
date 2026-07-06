import { useEffect } from 'react'
import { useGetAssets, useGetWithdrawals, useGetFetes } from '../hooks/backend/fete'
import { Card, CardContent, CardHeader, CardTitle } from '../lib/shadcn/card'
import { Package, ArrowUpFromLine, Tent, AlertTriangle } from 'lucide-react'
import type { AppUser } from './Login'

interface Props { currentUser: AppUser }

type Asset = {
  id: number; name: string; category: string
  quantity_total: number; quantity_available: number
  location_name: string
}

type Withdrawal = {
  id: number; asset_name: string; withdrawn_by_name: string
  withdrawn_at: string; quantity: number; fete_name?: string
}

type Fete = { id: number; status: string; name: string }

export default function Dashboard({ currentUser }: Props) {
  const { data: assetsRaw, trigger: loadAssets } = useGetAssets()
  const { data: withdrawalsRaw, trigger: loadWithdrawals } = useGetWithdrawals()
  const { data: fetesRaw, trigger: loadFetes } = useGetFetes()

  useEffect(() => {
    void loadAssets({})
    void loadWithdrawals({ status: 'out' })
    void loadFetes({})
  }, [])

  const assets = (assetsRaw ?? []) as Asset[]
  const withdrawals = (withdrawalsRaw ?? []) as Withdrawal[]
  const fetes = (fetesRaw ?? []) as Fete[]

  const lowStock = assets.filter(a => a.quantity_available === 0).length
  const itemsOut = withdrawals.length
  const activeFetes = fetes.filter(f => f.status === 'active').length

  const recentWithdrawals = withdrawals.slice(0, 5)

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground">Welcome back, {currentUser.name}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Package className="w-4 h-4" /> Asset Types
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{assets.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <ArrowUpFromLine className="w-4 h-4" /> Items Out
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-amber-600 dark:text-amber-400">{itemsOut}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Tent className="w-4 h-4" /> Active Fetes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-primary">{activeFetes}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> Out of Stock
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-destructive">{lowStock}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Low / out of stock */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Stock Alert</CardTitle>
          </CardHeader>
          <CardContent>
            {assets.filter(a => a.quantity_available < 2).length === 0 ? (
              <p className="text-muted-foreground text-sm">All items well stocked.</p>
            ) : (
              <ul className="space-y-2">
                {assets.filter(a => a.quantity_available < 2).map(asset => (
                  <li key={asset.id} className="flex justify-between items-center text-sm">
                    <span>{asset.name}</span>
                    <span className={`font-semibold ${asset.quantity_available === 0 ? 'text-destructive' : 'text-amber-600 dark:text-amber-400'}`}>
                      {asset.quantity_available} left
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Items currently out */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Items Currently Out</CardTitle>
          </CardHeader>
          <CardContent>
            {recentWithdrawals.length === 0 ? (
              <p className="text-muted-foreground text-sm">Nothing currently checked out.</p>
            ) : (
              <ul className="space-y-2">
                {recentWithdrawals.map(w => (
                  <li key={w.id} className="text-sm border-b border-border pb-2 last:border-0">
                    <span className="font-medium">{w.asset_name}</span>
                    <span className="text-muted-foreground"> × {w.quantity}</span>
                    <div className="text-xs text-muted-foreground">
                      {w.withdrawn_by_name} · {new Date(w.withdrawn_at).toLocaleDateString()}
                      {w.fete_name && ` · ${w.fete_name}`}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
