import { useEffect, useMemo, useState } from 'react'
import { useGetFetes } from '../hooks/backend/fete'
import { Badge } from '../lib/shadcn/badge'
import { Button } from '../lib/shadcn/button'
import { Card, CardContent, CardHeader, CardTitle } from '../lib/shadcn/card'
import { Input } from '../lib/shadcn/input'
import { CalendarDays, MapPin, Tent, Search, Users } from 'lucide-react'

type Fete = {
  id: number
  name: string
  event_date: string
  description: string
  notes: string
  status: 'planned' | 'active' | 'completed'
  location_name: string | null
  volunteer_count?: number
}

const STATUS_LABELS: Record<Fete['status'], string> = {
  planned: 'Planned',
  active: 'Active',
  completed: 'Completed',
}

const STATUS_STYLES: Record<Fete['status'], 'secondary' | 'default' | 'outline'> = {
  planned: 'secondary',
  active: 'default',
  completed: 'outline',
}

function formatEventDate(eventDate: string) {
  return new Date(eventDate).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function getCapacityBadge(count: number): {
  label: string
  variant: 'default' | 'secondary' | 'outline'
} {
  if (count >= 8) {
    return { label: 'High capacity', variant: 'default' }
  }

  if (count >= 4) {
    return { label: 'Medium capacity', variant: 'secondary' }
  }

  return { label: 'Open spots', variant: 'outline' }
}

export default function PublicEventsPage() {
  const { data: fetesRaw, trigger: loadFetes } = useGetFetes()
  const [searchText, setSearchText] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  useEffect(() => {
    void loadFetes({})
  }, [])

  const fetes = (fetesRaw ?? []) as Fete[]

  const filteredEvents = useMemo(() => {
    const normalizedSearch = searchText.trim().toLowerCase()

    return [...fetes]
      .filter((fete) => {
        const eventDay = fete.event_date ? fete.event_date.slice(0, 10) : ''

        if (startDate && eventDay && eventDay < startDate) return false
        if (endDate && eventDay && eventDay > endDate) return false

        if (!normalizedSearch) return true

        const searchable = [
          fete.name,
          fete.description,
          fete.notes,
          fete.location_name ?? '',
        ].join(' ').toLowerCase()

        return searchable.includes(normalizedSearch)
      })
      .sort((left, right) => left.event_date.localeCompare(right.event_date))
  }, [fetes, searchText, startDate, endDate])

  const hasActiveFilters = searchText.trim().length > 0 || Boolean(startDate) || Boolean(endDate)

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/60 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-4 py-6">
          <div className="inline-flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <Tent className="w-4 h-4 text-primary" />
            Oxon Group
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Fete Events</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Public information view of upcoming and recent fete events.
          </p>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Find an event</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <label htmlFor="event-search" className="text-xs font-medium text-muted-foreground">Search</label>
                <div className="relative">
                  <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                  <Input
                    id="event-search"
                    value={searchText}
                    onChange={(event) => setSearchText(event.target.value)}
                    placeholder="Search by event, venue, or notes"
                    className="pl-9"
                  />
                </div>
              </div>
              <div className="grid gap-3 grid-cols-2">
                <div className="space-y-1">
                  <label htmlFor="start-date" className="text-xs font-medium text-muted-foreground">From</label>
                  <Input
                    id="start-date"
                    type="date"
                    value={startDate}
                    onChange={(event) => setStartDate(event.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="end-date" className="text-xs font-medium text-muted-foreground">To</label>
                  <Input
                    id="end-date"
                    type="date"
                    value={endDate}
                    onChange={(event) => setEndDate(event.target.value)}
                  />
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <p className="text-xs text-muted-foreground">
                Showing {filteredEvents.length} of {fetes.length} events
              </p>
              {hasActiveFilters && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearchText('')
                    setStartDate('')
                    setEndDate('')
                  }}
                >
                  Clear filters
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {filteredEvents.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              {fetes.length === 0
                ? 'No fete events are currently listed.'
                : 'No events match your current filters.'}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredEvents.map((fete) => {
              const volunteerCount = fete.volunteer_count ?? 0
              const capacityBadge = getCapacityBadge(volunteerCount)

              return (
              <Card key={fete.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <CardTitle className="text-xl leading-tight">{fete.name}</CardTitle>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <Badge variant={STATUS_STYLES[fete.status]}>{STATUS_LABELS[fete.status]}</Badge>
                        <Badge variant={capacityBadge.variant} className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {capacityBadge.label}
                        </Badge>
                        <Badge variant="outline">{volunteerCount} booked</Badge>
                        {fete.location_name && (
                          <Badge variant="outline" className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {fete.location_name}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground flex items-center gap-1">
                      <CalendarDays className="w-4 h-4" />
                      {formatEventDate(fete.event_date)}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {fete.description && <p className="text-sm text-foreground/90">{fete.description}</p>}
                  {fete.notes && <p className="text-sm text-muted-foreground">{fete.notes}</p>}
                </CardContent>
              </Card>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}