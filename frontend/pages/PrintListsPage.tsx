import { useEffect, useMemo, useState } from 'react'
import {
  useGetAssets,
  useGetFeteAssetPickList,
  useGetFeteLocations,
  useGetFetes,
  useGetLocations,
  useGetVolunteerShifts,
  useGetVolunteers,
} from '../hooks/backend/fete'
import { Button } from '../lib/shadcn/button'
import { Card, CardContent, CardHeader, CardTitle } from '../lib/shadcn/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../lib/shadcn/select'
import { Printer, Calendar, MapPin, Package, Download, Users } from 'lucide-react'
import type { AppUser } from './Login'

interface Props { currentUser: AppUser }

type PrintReport = 'events' | 'locations' | 'assets' | 'picklists'

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
  quantity_booked?: number
  location_name: string | null
  storage_area_name: string | null
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
  email: string
  phone: string
}

type VolunteerShift = {
  id: number
  volunteer_id: number
  volunteer_name: string
  fete_id: number | null
  roles: string[]
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

function formatDayMonth(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  })
}

export default function PrintListsPage({ currentUser }: Props) {
  const { data: fetesRaw, trigger: loadFetes } = useGetFetes()
  const { data: storeLocationsRaw, trigger: loadStoreLocations } = useGetLocations()
  const { data: feteLocationsRaw, trigger: loadFeteLocations } = useGetFeteLocations()
  const { data: assetsRaw, trigger: loadAssets } = useGetAssets()
  const { data: fetePickListRaw, trigger: loadFetePickList } = useGetFeteAssetPickList()
  const { data: volunteersRaw, trigger: loadVolunteers } = useGetVolunteers()
  const { data: volunteerShiftsRaw, trigger: loadVolunteerShifts } = useGetVolunteerShifts()
  const [selectedReport, setSelectedReport] = useState<PrintReport>('events')
  const [selectedFeteId, setSelectedFeteId] = useState<string>('')
  const [isPrintingAll, setIsPrintingAll] = useState(false)
  const [showShortagesOnly, setShowShortagesOnly] = useState(false)
  const [eventVolunteerFeteId, setEventVolunteerFeteId] = useState('all')

  useEffect(() => {
    void loadFetes({})
    void loadStoreLocations({})
    void loadFeteLocations({})
    void loadAssets({})
    void loadFetePickList({ status: 'all' })
    void loadVolunteers({})
    void loadVolunteerShifts({})
  }, [])

  const fetes = (fetesRaw ?? []) as Fete[]
  const storeLocations = (storeLocationsRaw ?? []) as Location[]
  const feteLocations = (feteLocationsRaw ?? []) as Location[]
  const assets = (assetsRaw ?? []) as Asset[]
  const fetePickList = (fetePickListRaw ?? []) as FeteAssetPickItem[]
  const volunteers = (volunteersRaw ?? []) as Volunteer[]
  const volunteerShifts = (volunteerShiftsRaw ?? []) as VolunteerShift[]

  const locations = useMemo(
    () => [
      ...storeLocations.map((location) => ({ ...location, location_type: 'Store' as const })),
      ...feteLocations.map((location) => ({ ...location, location_type: 'Fete' as const })),
    ],
    [storeLocations, feteLocations],
  )

  const assetReportRows = useMemo(
    () => assets
      .map((asset) => ({ ...asset, category: normalizeAssetCategory(asset.category) }))
      .sort((left, right) => {
        const leftLocation = left.location_name ?? 'Unassigned Location'
        const rightLocation = right.location_name ?? 'Unassigned Location'
        const locationOrder = leftLocation.localeCompare(rightLocation)
        if (locationOrder !== 0) return locationOrder

        const leftArea = left.storage_area_name ?? 'Unassigned Area'
        const rightArea = right.storage_area_name ?? 'Unassigned Area'
        const areaOrder = leftArea.localeCompare(rightArea)
        if (areaOrder !== 0) return areaOrder
        return left.name.localeCompare(right.name)
      }),
    [assets],
  )

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

    for (const fete of fetes) {
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

  const selectedPickList = useMemo(
    () => filteredPickListsByFete.filter((group) => group.feteId === Number(selectedFeteId)),
    [filteredPickListsByFete, selectedFeteId],
  )

  const volunteersByFete = useMemo(() => fetes.map(fete => ({
    fete,
    volunteers: volunteerShifts
      .filter(shift => shift.fete_id === fete.id)
      .map(shift => ({ ...shift, volunteer: volunteers.find(volunteer => volunteer.id === shift.volunteer_id) }))
      .sort((left, right) => left.volunteer_name.localeCompare(right.volunteer_name)),
  })), [fetes, volunteerShifts, volunteers])

  const filteredVolunteersByFete = useMemo(() => (
    eventVolunteerFeteId === 'all'
      ? volunteersByFete
      : volunteersByFete.filter(({ fete }) => fete.id === Number(eventVolunteerFeteId))
  ), [eventVolunteerFeteId, volunteersByFete])

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
      setIsPrintingAll(false)
    }

    const handleMediaChange = (event: MediaQueryListEvent) => {
      if (!event.matches) {
        clearPrintSectionFilter()
        setIsPrintingAll(false)
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
      setIsPrintingAll(false)
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

  function printSelectedReport() {
    clearPrintSectionFilter()
    const reportSectionIds: Record<PrintReport, string> = {
      events: 'print-events',
      locations: 'print-locations',
      assets: 'print-assets',
      picklists: 'print-picklists',
    }
    printSection(reportSectionIds[selectedReport])
  }

  function printAllReports() {
    clearPrintSectionFilter()
    setIsPrintingAll(true)
    window.requestAnimationFrame(() => window.print())
  }

  function printEventVolunteers() {
    printSection('print-event-volunteers')
  }

  function downloadAssetCsv() {
    const columns = ['Store Location', 'Storage Area', 'Asset', 'Category', 'Total', 'Available', 'Booked', 'Notes']
    const escapeCsv = (value: unknown) => {
      const text = String(value ?? '')
      return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
    }
    const rows = assetReportRows.map((asset) => [
      asset.location_name ?? 'Unassigned Location',
      asset.storage_area_name ?? 'Unassigned Area',
      asset.name,
      asset.category,
      asset.quantity_total,
      asset.quantity_available,
      asset.quantity_booked ?? 0,
      asset.notes,
    ])
    const csv = [columns, ...rows].map(row => row.map(escapeCsv).join(',')).join('\r\n')
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `asset-location-area-report-${new Date().toISOString().slice(0, 10)}.csv`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="p-6 space-y-4 print-page">
      <div className="flex items-start justify-between gap-3 print-hidden">
        <div>
          <h1 className="text-2xl font-bold">Print Centre</h1>
          <p className="text-sm text-muted-foreground">
            Printable lists for events, locations, and assets by type.
          </p>
        </div>
      </div>

      <div className="space-y-3 print-hidden">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-1">
          <label className="text-sm font-medium" htmlFor="print-report">Select Print List</label>
          <Select value={selectedReport} onValueChange={(value) => setSelectedReport(value as PrintReport)}>
            <SelectTrigger id="print-report"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="events">Events</SelectItem>
              <SelectItem value="locations">Locations</SelectItem>
              <SelectItem value="assets">Assets by Location &amp; Area</SelectItem>
              <SelectItem value="picklists">Event Asset Pick Lists</SelectItem>
            </SelectContent>
          </Select>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={printSelectedReport} className="flex items-center gap-2">
              <Printer className="w-4 h-4" /> Print Selected List
            </Button>
            <Button onClick={printAllReports} className="flex items-center gap-2">
              <Printer className="w-4 h-4" /> Print All
            </Button>
          </div>
        </div>
        {selectedReport === 'picklists' && (
          <div className="max-w-md space-y-1">
            <label className="text-sm font-medium" htmlFor="print-fete">Event</label>
            <Select value={selectedFeteId} onValueChange={setSelectedFeteId}>
              <SelectTrigger id="print-fete"><SelectValue placeholder="Select an event" /></SelectTrigger>
              <SelectContent>
                {fetes.map((fete) => (
                  <SelectItem key={fete.id} value={String(fete.id)}>
                    {fete.name} ({fete.status})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        {selectedReport === 'events' && (
          <div className="mt-4 max-w-md space-y-2 pl-6">
            <label className="block text-sm font-medium" htmlFor="event-volunteer-fete">Filter by Event</label>
            <Select value={eventVolunteerFeteId} onValueChange={setEventVolunteerFeteId}>
              <SelectTrigger id="event-volunteer-fete"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All events</SelectItem>
                {fetes.map(fete => <SelectItem key={fete.id} value={String(fete.id)}>{fete.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {(selectedReport === 'events' || isPrintingAll) && (
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
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="print-hidden"
              onClick={printEventVolunteers}
            >
              <Users className="w-3.5 h-3.5 mr-1" /> Print Event Volunteers
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
      )}

      {selectedReport === 'events' && (
      <Card id="card-print-event-volunteers" className="print-card print-hidden">
        <CardContent id="print-event-volunteers" className="space-y-5 print-section">
          <h2 className="text-lg font-semibold">Event Volunteers</h2>
          {filteredVolunteersByFete.map(({ fete, volunteers: eventVolunteers }) => (
            <section key={fete.id} className="print-avoid-break">
              <div className="mb-2 border-b border-border pb-1">
                <h3 className="font-semibold">{fete.name}</h3>
                <p className="text-xs text-muted-foreground">
                  {fete.event_date ? new Date(fete.event_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'No date'} · {fete.status}
                </p>
              </div>
              {eventVolunteers.length === 0 ? (
                <p className="text-sm text-muted-foreground">No volunteers assigned.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-border text-muted-foreground"><th className="text-left py-1 font-medium">Volunteer</th><th className="text-left py-1 font-medium">Email</th><th className="text-left py-1 font-medium">Phone</th><th className="text-left py-1 font-medium">Roles for this event</th><th className="text-left py-1 font-medium">Dates</th><th className="text-left py-1 font-medium">Times</th></tr></thead>
                  <tbody>{eventVolunteers.map(({ id, volunteer_name, volunteer, roles, start_date, end_date, start_time, end_time }) => <tr key={id} className="border-b border-border last:border-0"><td className="py-1.5 font-medium">{volunteer_name}</td><td className="py-1.5">{volunteer?.email || 'None'}</td><td className="py-1.5">{volunteer?.phone || 'None'}</td><td className="py-1.5">{roles.join(', ') || 'None'}</td><td className="py-1.5 whitespace-nowrap">{formatDayMonth(start_date)}{start_date !== end_date ? ` to ${formatDayMonth(end_date)}` : ''}</td><td className="py-1.5 whitespace-nowrap">{start_time} - {end_time}</td></tr>)}</tbody>
                </table>
              )}
            </section>
          ))}
          {filteredVolunteersByFete.length === 0 && <p className="text-sm text-muted-foreground">No events available.</p>}
          <p className="print-only-footer text-xs text-muted-foreground mt-3">Printed: {generatedAt}</p>
        </CardContent>
      </Card>
      )}

      {(selectedReport === 'locations' || isPrintingAll) && (
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
      )}

      {(selectedReport === 'assets' || isPrintingAll) && (
      <Card id="card-print-assets" className="print-card">
        <CardHeader className="print-header">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <CardTitle className="flex items-center gap-2 text-base">
              <Package className="w-4 h-4" /> Assets By Location &amp; Area
            </CardTitle>
            <div className="flex gap-2 print-hidden">
              <Button type="button" variant="outline" size="sm" onClick={() => printSection('print-assets')}>
                <Printer className="w-3.5 h-3.5 mr-1" /> Print Assets
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={downloadAssetCsv} disabled={assetReportRows.length === 0}>
                <Download className="w-3.5 h-3.5 mr-1" /> Export CSV
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent id="print-assets" className="space-y-4 print-section">
          {assetReportRows.length === 0 && (
            <p className="text-sm text-muted-foreground">No assets available.</p>
          )}
          {assetReportRows.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="text-left py-2 font-medium">Store Location</th>
                    <th className="text-left py-2 font-medium">Storage Area</th>
                    <th className="text-left py-2 font-medium">Asset</th>
                    <th className="text-left py-2 font-medium">Category</th>
                    <th className="text-right py-2 font-medium">Total</th>
                    <th className="text-right py-2 font-medium">Available</th>
                    <th className="text-right py-2 font-medium">Booked</th>
                    <th className="text-left py-2 font-medium">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {assetReportRows.map((asset) => (
                    <tr key={asset.id} className="border-b border-border align-top">
                      <td className="py-1.5">{asset.location_name ?? 'Unassigned Location'}</td>
                      <td className="py-1.5">{asset.storage_area_name ?? 'Unassigned Area'}</td>
                      <td className="py-1.5 font-medium">{asset.name}</td>
                      <td className="py-1.5">{asset.category}</td>
                      <td className="py-1.5 text-right">{asset.quantity_total}</td>
                      <td className="py-1.5 text-right">{asset.quantity_available}</td>
                      <td className="py-1.5 text-right">{asset.quantity_booked ?? 0}</td>
                      <td className="py-1.5">{asset.notes || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="print-only-footer text-xs text-muted-foreground mt-3">
            Printed: {generatedAt}
          </p>
        </CardContent>
      </Card>
      )}

      {(selectedReport === 'picklists' || isPrintingAll) && (
      <Card id="card-print-picklists" className="print-card">
        <CardHeader className="print-header">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <CardTitle className="flex items-center gap-2 text-base">
              <Package className="w-4 h-4" /> Event Asset Pick Lists
            </CardTitle>
            <div className="flex items-center gap-2 print-hidden">
              <Button
                type="button"
                variant={showShortagesOnly ? 'default' : 'outline'}
                size="sm"
                onClick={() => setShowShortagesOnly((prev) => !prev)}
              >
                {showShortagesOnly ? 'Showing Shortages' : 'Shortages Only'}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => printSection('print-picklists')}
              >
                <Printer className="w-3.5 h-3.5 mr-1" /> Print Pick Lists
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent id="print-picklists" className="space-y-4 print-section">
          {!selectedFeteId && (
            <p className="text-sm text-muted-foreground">Select an event to view its asset pick list.</p>
          )}
          {selectedFeteId && selectedPickList.length === 0 && (
            <p className="text-sm text-muted-foreground">
              {showShortagesOnly
                ? 'No shortages for this event.'
                : 'No event asset requirements available.'}
            </p>
          )}

          {selectedPickList.map((feteGroup) => (
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

    </div>
  )
}
