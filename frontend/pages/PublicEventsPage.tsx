import { useEffect, useMemo } from 'react'
import { useGetFetes } from '../hooks/backend/fete'
import { Badge } from '../lib/shadcn/badge'
import { Card, CardContent, CardHeader, CardTitle } from '../lib/shadcn/card'
import { CalendarDays, MapPin, Tent } from 'lucide-react'

type Fete = {
  id: number
  name: string
  event_date: string
  description: string
  notes: string
  status: 'planned' | 'active' | 'completed'
  location_name: string | null
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

export default function PublicEventsPage() {
  const { data: fetesRaw, trigger: loadFetes } = useGetFetes()

  useEffect(() => {
    void loadFetes({})
  }, [])

  const fetes = (fetesRaw ?? []) as Fete[]
  const upcoming = useMemo(
    () => [...fetes].sort((left, right) => left.event_date.localeCompare(right.event_date)),
    [fetes],
  )

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
        {upcoming.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              No fete events are currently listed.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {upcoming.map((fete) => (
              <Card key={fete.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <CardTitle className="text-xl leading-tight">{fete.name}</CardTitle>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <Badge variant={STATUS_STYLES[fete.status]}>{STATUS_LABELS[fete.status]}</Badge>
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
            ))}
          </div>
        )}
      </main>
    </div>
  )
}