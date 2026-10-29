import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
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
import { Input } from '../lib/shadcn/input'
import { Printer, Calendar, MapPin, Package, Download, Users, Table } from 'lucide-react'
import type { AppUser } from './Login'

interface Props { currentUser: AppUser }

type PrintReport = 'volunteer-matrix' | 'event-volunteers' | 'events' | 'locations' | 'assets' | 'picklists'

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
  name?: string
  email: string
  phone: string
}

type VolunteerShift = {
  id: number
  volunteer_id: number
  volunteer_name: string
  fete_id: number | null
  fete_name?: string | null
  role?: string
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

function isShiftForFete(shift: VolunteerShift, fete: Fete): boolean {
  if (shift.fete_id != null && fete.id != null) {
    if (Number(shift.fete_id) === Number(fete.id)) return true
    if (String(shift.fete_id) === String(fete.id)) return true
  }
  if (shift.fete_name && fete.name) {
    if (shift.fete_name.trim().toLowerCase() === fete.name.trim().toLowerCase()) return true
  }
  return false
}

function shiftHasTask(shift: VolunteerShift, task: string): boolean {
  if (Array.isArray(shift.roles) && shift.roles.length > 0) {
    return shift.roles.includes(task)
  }
  if ((shift as unknown as { role?: string }).role) {
    return (shift as unknown as { role?: string }).role === task
  }
  return task === 'Helper'
}

function isShiftInHourSlot(shift: VolunteerShift, slotStart: string, slotEnd: string): boolean {
  const [sh, sm] = (shift.start_time || '00:00').split(':').map(Number)
  const [eh, em] = (shift.end_time || '00:00').split(':').map(Number)
  const [ssh, ssm] = slotStart.split(':').map(Number)
  const [seh, sem] = slotEnd.split(':').map(Number)

  const sStart = (sh || 0) * 60 + (sm || 0)
  const sEnd = (eh || 0) * 60 + (em || 0)
  const slStart = (ssh || 0) * 60 + (ssm || 0)
  const slEnd = (seh || 0) * 60 + (sem || 0)

  return sStart < slEnd && sEnd > slStart
}

export default function PrintListsPage({ currentUser }: Props) {
  const { data: fetesRaw, trigger: loadFetes } = useGetFetes()
  const { data: storeLocationsRaw, trigger: loadStoreLocations } = useGetLocations()
  const { data: feteLocationsRaw, trigger: loadFeteLocations } = useGetFeteLocations()
  const { data: assetsRaw, trigger: loadAssets } = useGetAssets()
  const { data: fetePickListRaw, trigger: loadFetePickList } = useGetFeteAssetPickList()
  const { data: volunteersRaw, trigger: loadVolunteers } = useGetVolunteers()
  const { data: volunteerShiftsRaw, trigger: loadVolunteerShifts } = useGetVolunteerShifts()
  const [searchParams] = useSearchParams()
  const initialReport = (searchParams.get('report') as PrintReport) || undefined
  const [selectedReport, setSelectedReport] = useState<PrintReport | undefined>(initialReport)
  const [selectedFeteId, setSelectedFeteId] = useState<string>('')
  const [isPrintingAll, setIsPrintingAll] = useState(false)
  const [showShortagesOnly, setShowShortagesOnly] = useState(false)
  const [eventVolunteerFeteId, setEventVolunteerFeteId] = useState('all')

  const [matrixFeteId, setMatrixFeteId] = useState<string>(searchParams.get('feteId') ?? '')
  const [matrixDate, setMatrixDate] = useState<string>(searchParams.get('date') ?? '')

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

  const eventFilterFetes = useMemo(() => {
    const statusOrder: Record<string, number> = { active: 0, planned: 1, archived: 2 }

    return [...fetes].sort((left, right) => {
      const leftStatusOrder = statusOrder[left.status.toLowerCase()] ?? Number.MAX_SAFE_INTEGER
      const rightStatusOrder = statusOrder[right.status.toLowerCase()] ?? Number.MAX_SAFE_INTEGER
      if (leftStatusOrder !== rightStatusOrder) return leftStatusOrder - rightStatusOrder
      return left.name.localeCompare(right.name)
    })
  }, [fetes])

  useEffect(() => {
    if (!matrixFeteId && eventFilterFetes.length > 0) {
      const defaultFete = eventFilterFetes[0]
      if (defaultFete) {
        setMatrixFeteId(String(defaultFete.id))
        if (!matrixDate && defaultFete.event_date) {
          setMatrixDate(defaultFete.event_date.split('T')[0])
        }
      }
    }
  }, [eventFilterFetes, matrixFeteId, matrixDate])

  const selectedMatrixFete = useMemo(() => {
    const fId = Number(matrixFeteId)
    return fetes.find(f => f.id === fId) ?? null
  }, [matrixFeteId, fetes])

  useEffect(() => {
    if (selectedMatrixFete?.event_date && !matrixDate) {
      setMatrixDate(selectedMatrixFete.event_date.split('T')[0])
    }
  }, [selectedMatrixFete, matrixDate])

  const availableDatesForMatrix = useMemo(() => {
    if (!selectedMatrixFete) return []
    const dates = new Set<string>()
    if (selectedMatrixFete.event_date) {
      dates.add(selectedMatrixFete.event_date.split('T')[0])
    }
    for (const s of volunteerShifts) {
      if (isShiftForFete(s, selectedMatrixFete)) {
        if (s.start_date) dates.add(s.start_date.split('T')[0])
        if (s.end_date) dates.add(s.end_date.split('T')[0])
      }
    }
    return Array.from(dates).sort()
  }, [selectedMatrixFete, volunteerShifts])

  const shiftsForMatrix = useMemo(() => {
    if (!selectedMatrixFete || !matrixDate) return []
    return volunteerShifts.filter(shift => {
      if (!isShiftForFete(shift, selectedMatrixFete)) return false
      const sDate = shift.start_date.split('T')[0]
      const eDate = (shift.end_date || shift.start_date).split('T')[0]
      return matrixDate >= sDate && matrixDate <= eDate
    })
  }, [selectedMatrixFete, matrixDate, volunteerShifts])

  const matrixTaskColumns = useMemo(() => {
    const defaultTasks = [
      'Lead Volunteer',
      'Helper',
      'Putting Up',
      'Taking Down',
      'Transport',
      'Stall Holder',
    ]
    const extraTasks = new Set<string>()
    for (const shift of shiftsForMatrix) {
      if (Array.isArray(shift.roles)) {
        for (const r of shift.roles) {
          if (r && r.trim() && !defaultTasks.includes(r.trim())) {
            extraTasks.add(r.trim())
          }
        }
      }
    }
    return [...defaultTasks, ...Array.from(extraTasks)]
  }, [shiftsForMatrix])

  const matrixHours = useMemo(() => {
    let minH = 9
    let maxH = 18
    for (const s of shiftsForMatrix) {
      if (s.start_time) {
        const h = parseInt(s.start_time.slice(0, 2), 10)
        if (!isNaN(h) && h < minH) minH = h
      }
      if (s.end_time) {
        const h = parseInt(s.end_time.slice(0, 2), 10)
        const m = parseInt(s.end_time.slice(3, 5), 10)
        const totalH = m > 0 ? h + 1 : h
        if (!isNaN(totalH) && totalH > maxH) maxH = totalH
      }
    }
    const result: Array<{ start: string; end: string; label: string }> = []
    for (let h = minH; h < maxH; h++) {
      const sStr = String(h).padStart(2, '0') + ':00'
      const eStr = String(h + 1).padStart(2, '0') + ':00'
      result.push({ start: sStr, end: eStr, label: `${sStr} – ${eStr}` })
    }
    return result
  }, [shiftsForMatrix])

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
      .filter(shift => isShiftForFete(shift, fete))
      .map(shift => {
        const vol = volunteers.find(v => String(v.id) === String(shift.volunteer_id) || Number(v.id) === Number(shift.volunteer_id))
        return {
          ...shift,
          volunteer: vol,
          volunteer_name: shift.volunteer_name || vol?.name || `Volunteer #${shift.volunteer_id}`,
        }
      })
      .sort((left, right) => (left.volunteer_name || '').localeCompare(right.volunteer_name || '')),
  })), [fetes, volunteerShifts, volunteers])

  const unassignedEventShifts = useMemo(() => {
    return volunteerShifts
      .filter(shift => !fetes.some(fete => isShiftForFete(shift, fete)))
      .map(shift => {
        const vol = volunteers.find(v => String(v.id) === String(shift.volunteer_id) || Number(v.id) === Number(shift.volunteer_id))
        return {
          ...shift,
          volunteer: vol,
          volunteer_name: shift.volunteer_name || vol?.name || `Volunteer #${shift.volunteer_id}`,
        }
      })
      .sort((left, right) => (left.volunteer_name || '').localeCompare(right.volunteer_name || ''))
  }, [volunteerShifts, fetes, volunteers])

  const filteredVolunteersByFete = useMemo(() => (
    eventVolunteerFeteId === 'all'
      ? volunteersByFete
      : volunteersByFete.filter(({ fete }) => String(fete.id) === String(eventVolunteerFeteId) || Number(fete.id) === Number(eventVolunteerFeteId))
  ), [eventVolunteerFeteId, volunteersByFete])

  const filteredEventReportFetes = useMemo(() => (
    eventVolunteerFeteId === 'all'
      ? fetes
      : fetes.filter(fete => String(fete.id) === String(eventVolunteerFeteId) || Number(fete.id) === Number(eventVolunteerFeteId))
  ), [eventVolunteerFeteId, fetes])

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
    if (!selectedReport) return

    clearPrintSectionFilter()
    const reportSectionIds: Record<PrintReport, string> = {
      'volunteer-matrix': 'print-volunteer-matrix',
      'event-volunteers': 'print-event-volunteers',
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

  function downloadVolunteerMatrixCsv() {
    if (!selectedMatrixFete || !matrixDate) return
    const escapeCsv = (val: unknown) => {
      const text = String(val ?? '')
      return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
    }

    const headers = ['Hour', ...matrixTaskColumns, 'Total Volunteers']
    const rows = matrixHours.map(h => {
      const counts = matrixTaskColumns.map(t => {
        const cShifts = shiftsForMatrix.filter(s =>
          isShiftInHourSlot(s, h.start, h.end) && shiftHasTask(s, t)
        )
        return new Set(cShifts.map(s => s.volunteer_name)).size
      })
      const totalHour = new Set(
        shiftsForMatrix.filter(s => isShiftInHourSlot(s, h.start, h.end)).map(s => s.volunteer_name)
      ).size
      return [h.label, ...counts, totalHour]
    })

    const summaryRow = [
      'Total Volunteers (All Day)',
      ...matrixTaskColumns.map(t => {
        return new Set(shiftsForMatrix.filter(s => shiftHasTask(s, t)).map(s => s.volunteer_name)).size
      }),
      new Set(shiftsForMatrix.map(s => s.volunteer_name)).size,
    ]

    const csvContent = [headers, ...rows, summaryRow]
      .map(row => row.map(escapeCsv).join(','))
      .join('\r\n')

    const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `volunteer-rota-spreadsheet-${selectedMatrixFete.name.replace(/\s+/g, '-')}-${matrixDate}.csv`
    anchor.click()
    URL.revokeObjectURL(url)
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
          <div className="flex-1 rounded-md border border-primary/40 bg-primary/5 p-3 space-y-1">
            <label className="text-sm font-medium" htmlFor="print-report">Select Print List</label>
            <Select value={selectedReport} onValueChange={(value) => setSelectedReport(value as PrintReport)}>
              <SelectTrigger id="print-report"><SelectValue placeholder="Choose a print list" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="volunteer-matrix">Volunteer Rota Spreadsheet (Hours × Tasks)</SelectItem>
                <SelectItem value="event-volunteers">Event Volunteers List</SelectItem>
                <SelectItem value="events">Events Summary List</SelectItem>
                <SelectItem value="picklists">Event Asset Pick Lists</SelectItem>
                <SelectItem value="assets">Assets by Location &amp; Area</SelectItem>
                <SelectItem value="locations">Locations</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={printSelectedReport} disabled={!selectedReport} className="flex items-center gap-2">
              <Printer className="w-4 h-4" /> Print Selected List
            </Button>
            <Button onClick={printAllReports} className="flex items-center gap-2">
              <Printer className="w-4 h-4" /> Print All
            </Button>
          </div>
        </div>
        {selectedReport === 'volunteer-matrix' && (
          <div className="rounded-lg border border-primary/30 bg-card p-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium" htmlFor="matrix-fete">Event</label>
                <Select value={matrixFeteId} onValueChange={(val) => {
                  setMatrixFeteId(val)
                  const f = fetes.find(item => item.id === Number(val))
                  if (f && f.event_date) {
                    setMatrixDate(f.event_date.split('T')[0])
                  }
                }}>
                  <SelectTrigger id="matrix-fete"><SelectValue placeholder="Select an event" /></SelectTrigger>
                  <SelectContent>
                    {eventFilterFetes.map(fete => (
                      <SelectItem key={fete.id} value={String(fete.id)}>
                        {fete.name} ({fete.status})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium" htmlFor="matrix-date">Date for Rota Spreadsheet</label>
                <Input
                  id="matrix-date"
                  type="date"
                  value={matrixDate}
                  onChange={(e) => setMatrixDate(e.target.value)}
                />
              </div>
            </div>

            {availableDatesForMatrix.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap pt-1 text-xs">
                <span className="text-muted-foreground font-medium">Quick Dates:</span>
                {availableDatesForMatrix.map(d => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setMatrixDate(d)}
                    className={`px-2 py-1 rounded border transition-colors ${
                      matrixDate === d
                        ? 'bg-primary text-primary-foreground border-primary font-medium'
                        : 'bg-muted hover:bg-muted/80 text-foreground border-border'
                    }`}
                  >
                    {formatDayMonth(d)}
                    {selectedMatrixFete?.event_date?.split('T')[0] === d ? ' (Event Day)' : ''}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
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
        {(selectedReport === 'events' || selectedReport === 'event-volunteers') && (
          <div className="mt-4 max-w-md space-y-2 pl-6">
            <label className="block rounded-md bg-zinc-300 px-3 py-2 text-sm font-medium dark:bg-zinc-600" htmlFor="event-volunteer-fete">Filter by Event</label>
            <Select value={eventVolunteerFeteId} onValueChange={setEventVolunteerFeteId}>
              <SelectTrigger id="event-volunteer-fete"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All events</SelectItem>
                {eventFilterFetes.map(fete => <SelectItem key={fete.id} value={String(fete.id)}>{fete.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {(selectedReport === 'events' || isPrintingAll) && (
      <Card id="card-print-events" className="print-card">
        <CardHeader className="print-header bg-zinc-300 dark:bg-zinc-600">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <CardTitle className="flex items-center gap-2 text-base">
              <Calendar className="w-4 h-4" /> Events
            </CardTitle>
            <div className="flex items-center gap-2 print-hidden">
              {eventVolunteerFeteId !== 'all' && (
                <Button type="button" variant="outline" size="sm" onClick={() => setEventVolunteerFeteId('all')}>
                  Show all events
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => printSection('print-events')}
              >
                <Printer className="w-3.5 h-3.5 mr-1" /> Print Events
              </Button>
            </div>
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
              {filteredEventReportFetes.map((fete) => (
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
                    <button
                      type="button"
                      className="font-medium text-left hover:underline print:pointer-events-none"
                      onClick={() => setEventVolunteerFeteId((currentId) => (
                        currentId === String(fete.id) ? 'all' : String(fete.id)
                      ))}
                    >
                      {fete.name}
                    </button>
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
          {filteredEventReportFetes.length === 0 && (
            <p className="text-sm text-muted-foreground">No events match the selected filter.</p>
          )}
          <p className="print-only-footer text-xs text-muted-foreground mt-3">
            Printed: {generatedAt}
          </p>
        </CardContent>
      </Card>
      )}

      {(selectedReport === 'events' || selectedReport === 'event-volunteers' || isPrintingAll) && (
      <Card id="card-print-event-volunteers" className="print-card">
        <CardHeader className="print-header bg-zinc-300 dark:bg-zinc-600">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <CardTitle className="flex items-center gap-2 text-base"><Users className="w-4 h-4" /> Event Volunteers</CardTitle>
            <div className="flex items-center gap-2 print-hidden">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedReport('volunteer-matrix')
                  if (eventVolunteerFeteId !== 'all') {
                    setMatrixFeteId(eventVolunteerFeteId)
                  }
                }}
              >
                <Table className="w-3.5 h-3.5 mr-1" /> View Volunteer Spreadsheet
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={printEventVolunteers}>
                <Printer className="w-3.5 h-3.5 mr-1" /> Print Event Volunteers
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent id="print-event-volunteers" className="space-y-5 print-section">
          {filteredVolunteersByFete.map(({ fete, volunteers: eventVolunteers }) => (
            <section key={fete.id} className="print-avoid-break">
              <div className="mb-2 border-b border-border pb-1">
                <h3 className="font-semibold">{fete.name}</h3>
                <p className="text-xs text-muted-foreground">
                  {fete.event_date ? new Date(fete.event_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'No date'} · {fete.status}
                </p>
              </div>
              {eventVolunteers.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2 italic">No volunteers assigned to this event.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="text-left py-1 font-medium">Volunteer</th>
                      <th className="text-left py-1 font-medium">Email</th>
                      <th className="text-left py-1 font-medium">Phone</th>
                      <th className="text-left py-1 font-medium">Roles for this event</th>
                      <th className="text-left py-1 font-medium">Dates</th>
                      <th className="text-left py-1 font-medium">Times</th>
                    </tr>
                  </thead>
                  <tbody>
                    {eventVolunteers.map(({ id, volunteer_name, volunteer, roles, start_date, end_date, start_time, end_time }) => (
                      <tr key={id} className="border-b border-border last:border-0">
                        <td className="py-1.5 font-medium">{volunteer_name}</td>
                        <td className="py-1.5">{volunteer?.email || 'None'}</td>
                        <td className="py-1.5">{volunteer?.phone || 'None'}</td>
                        <td className="py-1.5">{Array.isArray(roles) && roles.length > 0 ? roles.join(', ') : 'None'}</td>
                        <td className="py-1.5 whitespace-nowrap">{formatDayMonth(start_date)}{start_date !== end_date ? ` to ${formatDayMonth(end_date)}` : ''}</td>
                        <td className="py-1.5 whitespace-nowrap">{start_time} - {end_time}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          ))}
          {unassignedEventShifts.length > 0 && eventVolunteerFeteId === 'all' && (
            <section className="print-avoid-break">
              <div className="mb-2 border-b border-border pb-1">
                <h3 className="font-semibold text-amber-700 dark:text-amber-400">General Volunteers (Unassigned Event)</h3>
                <p className="text-xs text-muted-foreground">Volunteers with scheduled shifts not linked to a specific event</p>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="text-left py-1 font-medium">Volunteer</th>
                    <th className="text-left py-1 font-medium">Email</th>
                    <th className="text-left py-1 font-medium">Phone</th>
                    <th className="text-left py-1 font-medium">Roles</th>
                    <th className="text-left py-1 font-medium">Dates</th>
                    <th className="text-left py-1 font-medium">Times</th>
                  </tr>
                </thead>
                <tbody>
                  {unassignedEventShifts.map(({ id, volunteer_name, volunteer, roles, start_date, end_date, start_time, end_time }) => (
                    <tr key={id} className="border-b border-border last:border-0">
                      <td className="py-1.5 font-medium">{volunteer_name}</td>
                      <td className="py-1.5">{volunteer?.email || 'None'}</td>
                      <td className="py-1.5">{volunteer?.phone || 'None'}</td>
                      <td className="py-1.5">{Array.isArray(roles) && roles.length > 0 ? roles.join(', ') : 'None'}</td>
                      <td className="py-1.5 whitespace-nowrap">{formatDayMonth(start_date)}{start_date !== end_date ? ` to ${formatDayMonth(end_date)}` : ''}</td>
                      <td className="py-1.5 whitespace-nowrap">{start_time} - {end_time}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}
          {filteredVolunteersByFete.length === 0 && unassignedEventShifts.length === 0 && (
            <p className="text-sm text-muted-foreground">No events or volunteers available.</p>
          )}
          <p className="print-only-footer text-xs text-muted-foreground mt-3">Printed: {generatedAt}</p>
        </CardContent>
      </Card>
      )}

      {(selectedReport === 'volunteer-matrix' || isPrintingAll) && (
      <Card id="card-print-volunteer-matrix" className="print-card">
        <CardHeader className="print-header bg-zinc-300 dark:bg-zinc-600">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Table className="w-4 h-4" /> Volunteer Rota Spreadsheet
              </CardTitle>
              {selectedMatrixFete && (
                <p className="text-xs text-muted-foreground mt-0.5 print:text-black">
                  <span className="font-semibold text-foreground print:text-black">{selectedMatrixFete.name}</span>
                  {matrixDate && (
                    <span> · {new Date(`${matrixDate}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
                  )}
                  {selectedMatrixFete.location_name && <span> · {selectedMatrixFete.location_name}</span>}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 print-hidden">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={downloadVolunteerMatrixCsv}
                disabled={!selectedMatrixFete || !matrixDate}
              >
                <Download className="w-3.5 h-3.5 mr-1" /> Export CSV
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => printSection('print-volunteer-matrix')}
                disabled={!selectedMatrixFete || !matrixDate}
              >
                <Printer className="w-3.5 h-3.5 mr-1" /> Print Spreadsheet
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent id="print-volunteer-matrix" className="space-y-6 print-section">
          {!selectedMatrixFete ? (
            <p className="text-sm text-muted-foreground p-4">Please select an event above.</p>
          ) : !matrixDate ? (
            <p className="text-sm text-muted-foreground p-4">Please select a date above.</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse border border-border spreadsheet-table">
                  <thead>
                    <tr className="bg-muted/80 text-foreground border-b border-border">
                      <th className="py-2.5 px-3 text-left font-semibold border-r border-border min-w-28">
                        Hour
                      </th>
                      {matrixTaskColumns.map(task => (
                        <th key={task} className="py-2.5 px-2 text-center font-semibold border-r border-border min-w-24">
                          {task}
                        </th>
                      ))}
                      <th className="py-2.5 px-2 text-center font-semibold bg-muted/60 min-w-20">
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {matrixHours.map((hour, idx) => {
                      const hourShifts = shiftsForMatrix.filter(s => isShiftInHourSlot(s, hour.start, hour.end))
                      const hourVolunteers = Array.from(new Set(hourShifts.map(s => s.volunteer_name))).sort()
                      const hourCount = hourVolunteers.length

                      return (
                        <tr
                          key={hour.start}
                          className={`border-b border-border ${idx % 2 === 0 ? 'bg-background' : 'bg-muted/10'}`}
                        >
                          <td className="py-2 px-3 font-medium text-foreground border-r border-border whitespace-nowrap">
                            {hour.label}
                          </td>
                          {matrixTaskColumns.map(task => {
                            const matchingShifts = shiftsForMatrix.filter(s =>
                              isShiftInHourSlot(s, hour.start, hour.end) && shiftHasTask(s, task)
                            )
                            const volunteersInCell = Array.from(new Set(matchingShifts.map(s => s.volunteer_name))).sort()
                            const cellCount = volunteersInCell.length

                            return (
                              <td
                                key={task}
                                className={`py-1.5 px-2 text-center border-r border-border align-middle ${
                                  cellCount > 0 ? 'bg-primary/5 dark:bg-primary/10 font-semibold' : ''
                                }`}
                              >
                                {cellCount > 0 ? (
                                  <div>
                                    <span className="text-sm font-bold text-foreground">
                                      {cellCount}
                                    </span>
                                    <div className="text-[10px] text-muted-foreground font-normal leading-tight mt-0.5 print:text-[9px] print:text-black">
                                      {volunteersInCell.join(', ')}
                                    </div>
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground/30 text-xs">—</span>
                                )}
                              </td>
                            )
                          })}
                          <td className="py-1.5 px-2 text-center font-bold bg-muted/30 align-middle">
                            {hourCount > 0 ? (
                              <span className="text-sm text-foreground">{hourCount}</span>
                            ) : (
                              <span className="text-muted-foreground/30 text-xs">0</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-muted font-bold border-t-2 border-border text-foreground">
                      <td className="py-2.5 px-3 border-r border-border">
                        Total / Peak
                      </td>
                      {matrixTaskColumns.map(task => {
                        const dayTaskVols = Array.from(new Set(
                          shiftsForMatrix.filter(s => shiftHasTask(s, task)).map(s => s.volunteer_name)
                        ))
                        const peak = Math.max(
                          0,
                          ...matrixHours.map(h => {
                            const active = shiftsForMatrix.filter(s => isShiftInHourSlot(s, h.start, h.end) && shiftHasTask(s, task))
                            return new Set(active.map(s => s.volunteer_name)).size
                          })
                        )

                        return (
                          <td key={task} className="py-2 px-2 text-center border-r border-border">
                            <span className="text-xs">{dayTaskVols.length}</span>
                            {peak > 0 && (
                              <span className="block text-[10px] text-muted-foreground font-normal print:text-[9px]">
                                peak {peak}
                              </span>
                            )}
                          </td>
                        )
                      })}
                      <td className="py-2 px-2 text-center text-xs">
                        {new Set(shiftsForMatrix.map(s => s.volunteer_name)).size}
                        <span className="block text-[10px] text-muted-foreground font-normal print:text-[9px]">
                          distinct
                        </span>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Roster breakdown for that day */}
              <div className="pt-2 print-avoid-break">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  Volunteer Roster for {matrixDate} ({shiftsForMatrix.length} shift allocations)
                </h4>
                {shiftsForMatrix.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">No volunteer shifts allocated for this event on this date.</p>
                ) : (
                  <div className="border border-border rounded overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-muted text-muted-foreground">
                        <tr className="border-b border-border text-left">
                          <th className="py-1.5 px-3 font-medium">Volunteer</th>
                          <th className="py-1.5 px-3 font-medium">Contact</th>
                          <th className="py-1.5 px-3 font-medium">Allocated Roles / Tasks</th>
                          <th className="py-1.5 px-3 font-medium">Hours</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {shiftsForMatrix.map(shift => {
                          const vol = volunteers.find(v => v.id === shift.volunteer_id)
                          return (
                            <tr key={shift.id}>
                              <td className="py-1 px-3 font-medium">{shift.volunteer_name}</td>
                              <td className="py-1 px-3 text-muted-foreground">{vol?.email || vol?.phone || '—'}</td>
                              <td className="py-1 px-3">{shift.roles?.join(', ') || 'Helper'}</td>
                              <td className="py-1 px-3 whitespace-nowrap">{shift.start_time} – {shift.end_time}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <p className="print-only-footer text-xs text-muted-foreground mt-3">
                Printed: {generatedAt}
              </p>
            </>
          )}
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
