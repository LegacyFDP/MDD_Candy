import { useEffect, useMemo } from 'react'
import {
  useGetAssets,
  useGetFeteLocations,
  useGetFetes,
  useGetLocations,
  useGetVolunteers,
} from '../hooks/backend/fete'
import { Button } from '../lib/shadcn/button'
import { Card, CardContent, CardHeader, CardTitle } from '../lib/shadcn/card'
import { Printer, Calendar, Handshake, MapPin, Package } from 'lucide-react'
import type { AppUser } from './Login'

interface Props { currentUser: AppUser }

type Fete = {
  id: number
  name: string
  event_date: string
  status: string
  description: string
  location_name: string | null
}

type Volunteer = {
  id: number
  name: string
  email: string
  address_line1: string
  address_line2: string
  town_city: string
  county: string
  postcode: string
  phone_home: string
  phone_mobile: string
  skills: string
  notes: string
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
  const { data: volunteersRaw, trigger: loadVolunteers } = useGetVolunteers()
  const { data: storeLocationsRaw, trigger: loadStoreLocations } = useGetLocations()
  const { data: feteLocationsRaw, trigger: loadFeteLocations } = useGetFeteLocations()
  const { data: assetsRaw, trigger: loadAssets } = useGetAssets()

  useEffect(() => {
    void loadFetes({})
    void loadVolunteers({})
    void loadStoreLocations({})
    void loadFeteLocations({})
    void loadAssets({})
  }, [])

  const fetes = (fetesRaw ?? []) as Fete[]
  const volunteers = (volunteersRaw ?? []) as Volunteer[]
  const storeLocations = (storeLocationsRaw ?? []) as Location[]
  const feteLocations = (feteLocationsRaw ?? []) as Location[]
  const assets = (assetsRaw ?? []) as Asset[]

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

  function clearPrintSectionFilter() {
    document.body.removeAttribute('data-print-section')
  }

  useEffect(() => {
    const mediaQueryList = window.matchMedia('print')

    const handleAfterPrint = () => {
      clearPrintSectionFilter()
    }

    const handleMediaChange = (event: MediaQueryListEvent) => {
      if (!event.matches) {
        clearPrintSectionFilter()
      }
    }

    window.addEventListener('afterprint', handleAfterPrint)
    if (typeof mediaQueryList.addEventListener === 'function') {
      mediaQueryList.addEventListener('change', handleMediaChange)
    } else {
      mediaQueryList.addListener(handleMediaChange)
    }

    return () => {
      window.removeEventListener('afterprint', handleAfterPrint)
      if (typeof mediaQueryList.removeEventListener === 'function') {
        mediaQueryList.removeEventListener('change', handleMediaChange)
      } else {
        mediaQueryList.removeListener(handleMediaChange)
      }
      clearPrintSectionFilter()
    }
  }, [])

  // Print regression checklist (manual):
  // 1) Short single-section list prints on one sheet (no trailing blank page).
  // 2) Long single-section list paginates naturally.
  // 3) Print All keeps section-per-page breaks.
  // 4) Re-run a short single-section print after a long one; behavior stays stable.
  function printSection(sectionId: string) {
    clearPrintSectionFilter()
    document.body.setAttribute('data-print-section', sectionId)
    window.print()
  }

  function printAllSections() {
    clearPrintSectionFilter()
    window.print()
  }

  return (
    <div className="p-6 space-y-4 print-page">
      <div className="flex items-start justify-between gap-3 print-hidden">
        <div>
          <h1 className="text-2xl font-bold">Print Centre</h1>
          <p className="text-sm text-muted-foreground">
            Printable lists for events, volunteers, locations, and assets by type.
          </p>
        </div>
        <Button onClick={printAllSections} className="flex items-center gap-2">
          <Printer className="w-4 h-4" /> Print All Lists
        </Button>
      </div>

      <Card id="card-print-events" className="print-card">
        <CardHeader className="print-header">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <CardTitle className="flex items-center gap-2 text-base">
              <Calendar className="w-4 h-4" /> Events
            </CardTitle>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="print-hidden"
              onClick={() => printSection('print-events')}
            >
              <Printer className="w-3.5 h-3.5 mr-1" /> Print Events
            </Button>
          </div>
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

      <Card id="card-print-volunteers" className="print-card">
        <CardHeader className="print-header">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <CardTitle className="flex items-center gap-2 text-base">
              <Handshake className="w-4 h-4" /> Volunteers
            </CardTitle>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="print-hidden"
              onClick={() => printSection('print-volunteers')}
            >
              <Printer className="w-3.5 h-3.5 mr-1" /> Print Volunteers
            </Button>
          </div>
        </CardHeader>
        <CardContent id="print-volunteers" className="space-y-2 print-section">
          {volunteers.length === 0 && (
            <p className="text-sm text-muted-foreground">No volunteers available.</p>
          )}
          {volunteers.map((volunteer) => (
            <div key={volunteer.id} className="border rounded-md p-3">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <p className="font-medium">{volunteer.name}</p>
                  <p className="text-sm text-muted-foreground">{volunteer.email}</p>
                </div>
                <div className="text-xs text-muted-foreground space-y-0.5 text-right">
                  <p>Home: {volunteer.phone_home || '-'}</p>
                  <p>Mobile: {volunteer.phone_mobile || '-'}</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {[
                  volunteer.address_line1,
                  volunteer.address_line2,
                  [volunteer.town_city, volunteer.county].filter(Boolean).join(', '),
                  volunteer.postcode,
                ]
                  .map((part) => part.trim())
                  .filter(Boolean)
                  .join(', ') || '-'}
              </p>
              <p className="text-sm mt-2"><span className="font-medium">Skills:</span> {volunteer.skills || '-'}</p>
              <p className="text-xs text-muted-foreground mt-1"><span className="font-medium">Notes:</span> {volunteer.notes || '-'}</p>
            </div>
          ))}
          <p className="print-only-footer text-xs text-muted-foreground mt-3">
            Printed: {generatedAt}
          </p>
        </CardContent>
      </Card>

      <Card id="card-print-locations" className="print-card">
        <CardHeader className="print-header">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <CardTitle className="flex items-center gap-2 text-base">
              <MapPin className="w-4 h-4" /> Locations
            </CardTitle>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="print-hidden"
              onClick={() => printSection('print-locations')}
            >
              <Printer className="w-3.5 h-3.5 mr-1" /> Print Locations
            </Button>
          </div>
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

      <Card id="card-print-assets" className="print-card">
        <CardHeader className="print-header">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <CardTitle className="flex items-center gap-2 text-base">
              <Package className="w-4 h-4" /> Assets By Type
            </CardTitle>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="print-hidden"
              onClick={() => printSection('print-assets')}
            >
              <Printer className="w-3.5 h-3.5 mr-1" /> Print Assets
            </Button>
          </div>
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
    </div>
  )
}
