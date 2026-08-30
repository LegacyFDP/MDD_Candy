import { useEffect, useMemo, useState } from 'react'
import {
  useGetAssets,
  useGetFeteAssetPickList,
  useGetFeteLocations,
  useGetFetes,
  useGetLocations,
  useGetVolunteers,
  useGetVolunteerShifts,
} from '../hooks/backend/fete'
import { Button } from '../lib/shadcn/button'
import { Card, CardContent, CardHeader, CardTitle } from '../lib/shadcn/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../lib/shadcn/select'
import { Printer, Calendar, MapPin, Package, CalendarRange, Users } from 'lucide-react'
import type { AppUser } from './Login'

interface Props { currentUser: AppUser }

const PRINT_TARGETS = [
  { id: 'all', label: 'All Lists' },
  { id: 'print-events', label: 'Events' },
  { id: 'print-locations', label: 'Locations' },
  { id: 'print-assets', label: 'Assets By Type' },
  { id: 'print-picklists', label: 'Event Asset Pick Lists' },
  { id: 'print-shift-rota', label: 'Volunteer Shift Rota' },
  { id: 'print-volunteers-by-event', label: 'Volunteers By Event' },
] as const

type Fete = {
  id: number
  name: string
  event_date: string
  status: string
  description: string
  location_name: string | null
}

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

type Asset = {
  id: number
  name: string
  category: string
  quantity_total: number
  quantity_available: number
  location_name: string | null
  notes: string
}

type FeteAssetPickItem = {
  fete_id: number
  fete_name: string
  event_date: string | null
  fete_status: string
  fete_location_name: string | null
  asset_id: number
  asset_name: string
  category: string
  store_location_name: string | null
  quantity_needed: number
  quantity_booked: number
  quantity_out: number
  quantity_required: number
  quantity_to_pick: number
  quantity_available: number
  quantity_short: number
  requirement_notes: string
  booking_notes: string
}

type Volunteer = {
  id: number
  name: string
  role: string
}

type VolunteerShift = {
  id: number
  volunteer_id: number
  volunteer_name: string
  fete_id: number | null
  fete_name: string | null
  role: string
  start_date: string
  end_date: string
  start_time: string
  end_time: string
}

const CATEGORY_ORDER = [
  'Decoration',
  'Electrical',
  'Equipment',
  'Furniture',
  'Linen',
  'Safety',
  'Shelter',
  'Stationery',
  'Toys',
  'Other',
]

function normalizeAssetCategory(category: string | null | undefined): string {
  const raw = (category ?? '').trim()
  if (!raw) return 'Other'

  const lower = raw.toLowerCase()
  const canonical = CATEGORY_ORDER.find((value) => value.toLowerCase() === lower)
  if (canonical) return canonical

  return raw
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0]?.toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

function formatAddress(location: Location): string {
  return [
    location.address_line1,
    location.address_line2,
    [location.town_city, location.county].filter(Boolean).join(', '),
    location.postcode,
  ]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(', ')
}

export default function PrintListsPage({ currentUser }: Props) {
  const { data: fetesRaw, trigger: loadFetes } = useGetFetes()
  const { data: storeLocationsRaw, trigger: loadStoreLocations } = useGetLocations()
  const { data: feteLocationsRaw, trigger: loadFeteLocations } = useGetFeteLocations()
  const { data: assetsRaw, trigger: loadAssets } = useGetAssets()
  const { data: fetePickListRaw, trigger: loadFetePickList } = useGetFeteAssetPickList()
  const { data: volunteersRaw, trigger: loadVolunteers } = useGetVolunteers()
  const { data: shiftsRaw, trigger: loadShifts } = useGetVolunteerShifts()
  const [showShortagesOnly, setShowShortagesOnly] = useState(false)
  const [printTarget, setPrintTarget] = useState<typeof PRINT_TARGETS[number]['id']>('all')
  const [shiftVolunteerFilter, setShiftVolunteerFilter] = useState<string>('all')

  useEffect(() => {
    void loadFetes({})
    void loadStoreLocations({})
    void loadFeteLocations({})
    void loadAssets({})
    void loadFetePickList({})
    void loadVolunteers({})
    void loadShifts({})
  }, [])

  const fetes = (fetesRaw ?? []) as Fete[]
  const storeLocations = (storeLocationsRaw ?? []) as Location[]
  const feteLocations = (feteLocationsRaw ?? []) as Location[]
  const assets = (assetsRaw ?? []) as Asset[]
  const fetePickList = (fetePickListRaw ?? []) as FeteAssetPickItem[]
  const volunteers = (volunteersRaw ?? []) as Volunteer[]
  const shifts = (shiftsRaw ?? []) as VolunteerShift[]

  const locations = useMemo(
    () => [
      ...storeLocations.map((location) => ({ ...location, location_type: 'Store' as const })),
      ...feteLocations.map((location) => ({ ...location, location_type: 'Fete' as const })),
    ],
    [storeLocations, feteLocations],
  )

  const assetsByCategory = useMemo(() => {
    const grouped = assets.reduce<Record<string, Asset[]>>((acc, asset) => {
      const category = normalizeAssetCategory(asset.category)
      if (!acc[category]) acc[category] = []
      acc[category]!.push({ ...asset, category })
      return acc
    }, {})

    return Object.entries(grouped)
      .sort(([left], [right]) => {
        const leftIndex = CATEGORY_ORDER.indexOf(left)
        const rightIndex = CATEGORY_ORDER.indexOf(right)

        const leftRank = leftIndex === -1 ? Number.MAX_SAFE_INTEGER : leftIndex
        const rightRank = rightIndex === -1 ? Number.MAX_SAFE_INTEGER : rightIndex

        if (leftRank !== rightRank) return leftRank - rightRank
        return left.localeCompare(right)
      })
      .map(([category, items]) => ({
        category,
        items: items.sort((left, right) => left.name.localeCompare(right.name)),
      }))
  }, [assets])

  const pickListsByFete = useMemo(() => {
    const grouped = new Map<number, {
      feteId: number
      feteName: string
      eventDate: string | null
      feteStatus: string
      feteLocationName: string | null
      items: FeteAssetPickItem[]
    }>()

    for (const row of fetePickList) {
      if (!grouped.has(row.fete_id)) {
        grouped.set(row.fete_id, {
          feteId: row.fete_id,
          feteName: row.fete_name,
          eventDate: row.event_date,
          feteStatus: row.fete_status,
          feteLocationName: row.fete_location_name,
          items: [],
        })
      }
      grouped.get(row.fete_id)!.items.push(row)
    }

    const groupedFromRequirements = Array.from(grouped.values())
      .map((group) => ({
        ...group,
        items: [...group.items].sort((left, right) => {
          const leftCategory = normalizeAssetCategory(left.category)
          const rightCategory = normalizeAssetCategory(right.category)
          const leftIndex = CATEGORY_ORDER.indexOf(leftCategory)
          const rightIndex = CATEGORY_ORDER.indexOf(rightCategory)

          const leftRank = leftIndex === -1 ? Number.MAX_SAFE_INTEGER : leftIndex
          const rightRank = rightIndex === -1 ? Number.MAX_SAFE_INTEGER : rightIndex
          if (leftRank !== rightRank) return leftRank - rightRank

          const byCategory = leftCategory.localeCompare(rightCategory)
          if (byCategory !== 0) return byCategory
          return left.asset_name.localeCompare(right.asset_name)
        }),
      }))

    // Keep event pick-list cards visible even when no requirements exist yet.
    const plannedOrActiveFetes = fetes.filter(
      (fete) => fete.status === 'planned' || fete.status === 'active',
    )

    const mergedByFete = new Map<number, {
      feteId: number
      feteName: string
      eventDate: string | null
      feteStatus: string
      feteLocationName: string | null
      items: FeteAssetPickItem[]
    }>()

    for (const group of groupedFromRequirements) {
      mergedByFete.set(group.feteId, group)
    }

    for (const fete of plannedOrActiveFetes) {
      if (!mergedByFete.has(fete.id)) {
        mergedByFete.set(fete.id, {
          feteId: fete.id,
          feteName: fete.name,
          eventDate: fete.event_date,
          feteStatus: fete.status,
          feteLocationName: fete.location_name,
          items: [],
        })
      }
    }

    return Array.from(mergedByFete.values()).sort((left, right) => {
      const leftDate = left.eventDate ?? ''
      const rightDate = right.eventDate ?? ''
      if (leftDate !== rightDate) return leftDate.localeCompare(rightDate)
      return left.feteName.localeCompare(right.feteName)
    })
  }, [fetePickList, fetes])

  const filteredPickListsByFete = useMemo(() => {
    if (!showShortagesOnly) return pickListsByFete

    return pickListsByFete
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => item.quantity_short > 0),
      }))
      .filter((group) => group.items.length > 0)
  }, [pickListsByFete, showShortagesOnly])

  const filteredShifts = useMemo(() => {
    if (shiftVolunteerFilter === 'all') return shifts
    const volunteerId = Number(shiftVolunteerFilter)
    return shifts.filter((shift) => shift.volunteer_id === volunteerId)
  }, [shifts, shiftVolunteerFilter])

  const volunteersByEvent = useMemo(() => {
    const grouped = new Map<number, {
      feteId: number
      feteName: string
      eventDate: string | null
      shifts: VolunteerShift[]
    }>()

    for (const shift of shifts) {
      if (shift.fete_id == null) continue
      if (!grouped.has(shift.fete_id)) {
        grouped.set(shift.fete_id, {
          feteId: shift.fete_id,
          feteName: shift.fete_name ?? 'Unknown event',
          eventDate: fetes.find((fete) => fete.id === shift.fete_id)?.event_date ?? null,
          shifts: [],
        })
      }
      grouped.get(shift.fete_id)!.shifts.push(shift)
    }

    return Array.from(grouped.values())
      .map((group) => ({
        ...group,
        shifts: [...group.shifts].sort((left, right) => left.volunteer_name.localeCompare(right.volunteer_name)),
      }))
      .sort((left, right) => (left.eventDate ?? '').localeCompare(right.eventDate ?? '') || left.feteName.localeCompare(right.feteName))
  }, [shifts, fetes])

  const generatedAt = new Date().toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  if (currentUser.role !== 'admin') {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Admin access required.</p>
      </div>
    )
  }

  const showAll = printTarget === 'all'

  return (
    <div className="p-6 space-y-4 print-page">
      <div className="flex items-start justify-between gap-3 print-hidden">
        <div>
          <h1 className="text-2xl font-bold">Print Centre</h1>
          <p className="text-sm text-muted-foreground">
            Printable lists for events, locations, and assets by type.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={printTarget} onValueChange={value => setPrintTarget(value as typeof PRINT_TARGETS[number]['id'])}>
            <SelectTrigger className="w-56"><SelectValue placeholder="Choose a list" /></SelectTrigger>
            <SelectContent>
              {PRINT_TARGETS.map(target => (
                <SelectItem key={target.id} value={target.id}>{target.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={() => window.print()} className="flex items-center gap-2">
            <Printer className="w-4 h-4" /> Print
          </Button>
        </div>
      </div>

      {(showAll || printTarget === 'print-events') && (
      <Card id="card-print-events" className={`print-card${showAll ? ' print-break-after' : ''}`}>
        <CardHeader className="print-header">
          <CardTitle className="flex items-center gap-2 text-base">
            <Calendar className="w-4 h-4" /> Events
          </CardTitle>
        </CardHeader>
        <CardContent id="print-events" className="print-section">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="text-left py-2 font-medium">Date</th>
                <th className="text-left py-2 font-medium">Event</th>
                <th className="text-left py-2 font-medium">Status</th>
                <th className="text-left py-2 font-medium">Location</th>
              </tr>
            </thead>
            <tbody>
              {fetes.map((fete) => (
                <tr key={fete.id} className="border-b border-border align-top">
                  <td className="py-2 whitespace-nowrap">
                    {fete.event_date
                      ? new Date(fete.event_date).toLocaleDateString('en-GB', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })
                      : '-'}
                  </td>
                  <td className="py-2">
                    <p className="font-medium">{fete.name}</p>
                    {fete.description && (
                      <p className="text-xs text-muted-foreground">{fete.description}</p>
                    )}
                  </td>
                  <td className="py-2 capitalize">{fete.status}</td>
                  <td className="py-2">{fete.location_name ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {fetes.length === 0 && (
            <p className="text-sm text-muted-foreground">No events available.</p>
          )}
          <p className="print-only-footer text-xs text-muted-foreground mt-3">
            Printed: {generatedAt}
          </p>
        </CardContent>
      </Card>
      )}

      {(showAll || printTarget === 'print-locations') && (
      <Card id="card-print-locations" className={`print-card${showAll ? ' print-break-after' : ''}`}>
        <CardHeader className="print-header">
          <CardTitle className="flex items-center gap-2 text-base">
            <MapPin className="w-4 h-4" /> Locations
          </CardTitle>
        </CardHeader>
        <CardContent id="print-locations" className="print-section">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="text-left py-2 font-medium">Type</th>
                <th className="text-left py-2 font-medium">Name</th>
                <th className="text-left py-2 font-medium">Address</th>
                <th className="text-left py-2 font-medium">Notes</th>
              </tr>
            </thead>
            <tbody>
              {locations.map((location) => (
                <tr key={`${location.location_type}-${location.id}`} className="border-b border-border align-top">
                  <td className="py-2">{location.location_type}</td>
                  <td className="py-2">
                    <p className="font-medium">{location.name}</p>
                    {location.description && (
                      <p className="text-xs text-muted-foreground">{location.description}</p>
                    )}
                  </td>
                  <td className="py-2">{formatAddress(location) || '-'}</td>
                  <td className="py-2">{location.notes || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {locations.length === 0 && (
            <p className="text-sm text-muted-foreground">No locations available.</p>
          )}
          <p className="print-only-footer text-xs text-muted-foreground mt-3">
            Printed: {generatedAt}
          </p>
        </CardContent>
      </Card>
      )}

      {(showAll || printTarget === 'print-assets') && (
      <Card id="card-print-assets" className={`print-card${showAll ? ' print-break-after' : ''}`}>
        <CardHeader className="print-header">
          <CardTitle className="flex items-center gap-2 text-base">
            <Package className="w-4 h-4" /> Assets By Type
          </CardTitle>
        </CardHeader>
        <CardContent id="print-assets" className="space-y-4 print-section">
          {assetsByCategory.length === 0 && (
            <p className="text-sm text-muted-foreground">No assets available.</p>
          )}
          {assetsByCategory.map((group) => (
            <div key={group.category} className="border rounded-md p-3 print-avoid-break">
              <p className="text-sm font-semibold mb-2">{group.category}</p>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="text-left py-1 font-medium">Asset</th>
                    <th className="text-left py-1 font-medium">Location</th>
                    <th className="text-right py-1 font-medium">Total</th>
                    <th className="text-right py-1 font-medium">Available</th>
                  </tr>
                </thead>
                <tbody>
                  {group.items.map((asset) => (
                    <tr key={asset.id} className="border-b border-border align-top">
                      <td className="py-1.5">
                        <p className="font-medium">{asset.name}</p>
                        {asset.notes && (
                          <p className="text-xs text-muted-foreground">{asset.notes}</p>
                        )}
                      </td>
                      <td className="py-1.5">{asset.location_name ?? '-'}</td>
                      <td className="py-1.5 text-right">{asset.quantity_total}</td>
                      <td className="py-1.5 text-right">{asset.quantity_available}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
          <p className="print-only-footer text-xs text-muted-foreground mt-3">
            Printed: {generatedAt}
          </p>
        </CardContent>
      </Card>
      )}

      {(showAll || printTarget === 'print-picklists') && (
      <Card id="card-print-picklists" className={`print-card${showAll ? ' print-break-after' : ''}`}>
        <CardHeader className="print-header">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <CardTitle className="flex items-center gap-2 text-base">
              <Package className="w-4 h-4" /> Event Asset Pick Lists
            </CardTitle>
            <Button
              type="button"
              variant={showShortagesOnly ? 'default' : 'outline'}
              size="sm"
              className="print-hidden"
              onClick={() => setShowShortagesOnly((prev) => !prev)}
            >
              {showShortagesOnly ? 'Showing Shortages' : 'Shortages Only'}
            </Button>
          </div>
        </CardHeader>
        <CardContent id="print-picklists" className="space-y-4 print-section">
          {filteredPickListsByFete.length === 0 && (
            <p className="text-sm text-muted-foreground">
              {showShortagesOnly
                ? 'No current shortages for planned/active events.'
                : 'No event asset requirements available.'}
            </p>
          )}

          {filteredPickListsByFete.map((feteGroup) => (
            <div key={feteGroup.feteId} className="border rounded-md p-3 print-avoid-break">
              <div className="flex items-start justify-between gap-3 flex-wrap mb-2">
                <div>
                  <p className="text-sm font-semibold">{feteGroup.feteName}</p>
                  <p className="text-xs text-muted-foreground">
                    {feteGroup.eventDate
                      ? new Date(feteGroup.eventDate).toLocaleDateString('en-GB', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })
                      : 'No date'}
                    {' · '}
                    {feteGroup.feteLocationName ?? 'No location'}
                    {' · '}
                    {feteGroup.feteStatus}
                  </p>
                </div>
              </div>

              {feteGroup.items.length === 0 ? (
                <p className="text-sm text-muted-foreground">No asset requirements set for this event yet.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="text-left py-1 font-medium">Asset</th>
                      <th className="text-left py-1 font-medium">Type</th>
                      <th className="text-left py-1 font-medium">Store</th>
                      <th className="text-right py-1 font-medium">Needed</th>
                      <th className="text-right py-1 font-medium">Booked</th>
                      <th className="text-right py-1 font-medium">Required</th>
                      <th className="text-right py-1 font-medium">Out</th>
                      <th className="text-right py-1 font-medium">Pick</th>
                      <th className="text-right py-1 font-medium">Avail.</th>
                      <th className="text-right py-1 font-medium">Short</th>
                    </tr>
                  </thead>
                  <tbody>
                    {feteGroup.items.map((item) => {
                      const normalizedCategory = normalizeAssetCategory(item.category)
                      return (
                        <tr key={`${feteGroup.feteId}-${item.asset_id}`} className="border-b border-border align-top">
                          <td className="py-1.5">
                            <p className="font-medium">{item.asset_name}</p>
                            {item.requirement_notes && (
                              <p className="text-xs text-muted-foreground">{item.requirement_notes}</p>
                            )}
                            {item.booking_notes && (
                              <p className="text-xs text-muted-foreground">Booking: {item.booking_notes}</p>
                            )}
                          </td>
                          <td className="py-1.5">{normalizedCategory}</td>
                          <td className="py-1.5">{item.store_location_name ?? '-'}</td>
                          <td className="py-1.5 text-right">{item.quantity_needed}</td>
                          <td className="py-1.5 text-right">{item.quantity_booked}</td>
                          <td className="py-1.5 text-right">{item.quantity_required}</td>
                          <td className="py-1.5 text-right">{item.quantity_out}</td>
                          <td className="py-1.5 text-right font-semibold">{item.quantity_to_pick}</td>
                          <td className="py-1.5 text-right">{item.quantity_available}</td>
                          <td className="py-1.5 text-right">
                            {item.quantity_short > 0 ? (
                              <span className="font-semibold text-red-700">{item.quantity_short}</span>
                            ) : '0'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          ))}

          <p className="print-only-footer text-xs text-muted-foreground mt-3">
            Printed: {generatedAt}
          </p>
        </CardContent>
      </Card>
      )}

      {(showAll || printTarget === 'print-shift-rota') && (
      <Card id="card-print-shift-rota" className={`print-card${showAll ? ' print-break-after' : ''}`}>
        <CardHeader className="print-header">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarRange className="w-4 h-4" /> Volunteer Shift Rota
            </CardTitle>
            <Select value={shiftVolunteerFilter} onValueChange={setShiftVolunteerFilter}>
              <SelectTrigger className="w-48 print-hidden"><SelectValue placeholder="Filter by volunteer" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All volunteers</SelectItem>
                {volunteers.map((vol) => (
                  <SelectItem key={vol.id} value={String(vol.id)}>{vol.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent id="print-shift-rota" className="print-section">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="text-left py-2 font-medium">Volunteer</th>
                <th className="text-left py-2 font-medium">Role</th>
                <th className="text-left py-2 font-medium">Dates</th>
                <th className="text-left py-2 font-medium">Times</th>
                <th className="text-left py-2 font-medium">Event</th>
              </tr>
            </thead>
            <tbody>
              {filteredShifts.map((shift) => (
                <tr key={shift.id} className="border-b border-border align-top">
                  <td className="py-2 font-medium">{shift.volunteer_name}</td>
                  <td className="py-2">{shift.role}</td>
                  <td className="py-2">
                    {shift.start_date}{shift.start_date !== shift.end_date ? ` to ${shift.end_date}` : ''}
                  </td>
                  <td className="py-2">{shift.start_time}–{shift.end_time}</td>
                  <td className="py-2">{shift.fete_name ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredShifts.length === 0 && (
            <p className="text-sm text-muted-foreground">
              {shiftVolunteerFilter === 'all' ? 'No volunteer shifts available.' : 'No shifts for this volunteer.'}
            </p>
          )}
          <p className="print-only-footer text-xs text-muted-foreground mt-3">
            Printed: {generatedAt}
          </p>
        </CardContent>
      </Card>
      )}

      {(showAll || printTarget === 'print-volunteers-by-event') && (
      <Card id="card-print-volunteers-by-event" className="print-card">
        <CardHeader className="print-header">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="w-4 h-4" /> Volunteers By Event
          </CardTitle>
        </CardHeader>
        <CardContent id="print-volunteers-by-event" className="space-y-4 print-section">
          {volunteersByEvent.length === 0 && (
            <p className="text-sm text-muted-foreground">No volunteers assigned to events yet.</p>
          )}
          {volunteersByEvent.map((group) => (
            <div key={group.feteId} className="border rounded-md p-3 print-avoid-break">
              <p className="text-sm font-semibold">{group.feteName}</p>
              {group.eventDate && (
                <p className="text-xs text-muted-foreground mb-2">
                  {new Date(group.eventDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                </p>
              )}
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="text-left py-1 font-medium">Volunteer</th>
                    <th className="text-left py-1 font-medium">Role</th>
                    <th className="text-left py-1 font-medium">Dates</th>
                    <th className="text-left py-1 font-medium">Times</th>
                  </tr>
                </thead>
                <tbody>
                  {group.shifts.map((shift) => (
                    <tr key={shift.id} className="border-b border-border align-top">
                      <td className="py-1.5">{shift.volunteer_name}</td>
                      <td className="py-1.5">{shift.role}</td>
                      <td className="py-1.5">
                        {shift.start_date}{shift.start_date !== shift.end_date ? ` to ${shift.end_date}` : ''}
                      </td>
                      <td className="py-1.5">{shift.start_time}–{shift.end_time}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
          <p className="print-only-footer text-xs text-muted-foreground mt-3">
            Printed: {generatedAt}
          </p>
        </CardContent>
      </Card>
      )}
    </div>
  )
}
