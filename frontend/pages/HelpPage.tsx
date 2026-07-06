import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../lib/shadcn/card'
import {
  LayoutDashboard, Package, Tent, ArrowUpFromLine,
  Users, MapPin, ChevronDown, ChevronRight, BookOpen,
  Shield, AlertTriangle, RotateCcw, Search, Filter
} from 'lucide-react'

interface Section {
  id: string
  title: string
  icon: React.ComponentType<{ className?: string }>
  adminOnly?: boolean
  content: React.ReactNode
}

const SECTIONS: Section[] = [
  {
    id: 'overview',
    title: 'Overview',
    icon: BookOpen,
    content: (
      <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
        <p>
          <strong className="text-foreground">Fete Store Manager</strong> is a charity asset management
          tool designed to track physical store items, fete events, and the movement of assets between
          your storage locations and events.
        </p>
        <p>Use the sidebar to navigate between sections. The sections available to you depend on your role:</p>
        <ul className="space-y-1 ml-4 list-disc">
          <li><strong className="text-foreground">Volunteers</strong> — can view and manage assets, fete events, and withdrawals.</li>
          <li><strong className="text-foreground">Admins</strong> — have full access including Locations and User management.</li>
        </ul>
      </div>
    ),
  },
  {
    id: 'dashboard',
    title: 'Dashboard',
    icon: LayoutDashboard,
    content: (
      <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
        <p>
          The Dashboard gives you an at-a-glance summary of the store's current status.
        </p>
        <div className="space-y-2">
          <ManualRow label="Total Assets" description="Number of distinct asset types registered in the store." />
          <ManualRow label="Items Out" description="Count of assets currently on withdrawal (not yet returned)." />
          <ManualRow label="Active Fetes" description="Number of fete events currently marked as active." />
          <ManualRow label="Out of Stock" description="Assets where zero units are currently available for withdrawal." />
        </div>
        <p>
          The <strong className="text-foreground">Recent Withdrawals</strong> list beneath the stats shows
          the latest items taken out, including who withdrew them and which fete they are for.
        </p>
      </div>
    ),
  },
  {
    id: 'assets',
    title: 'Store Assets',
    icon: Package,
    content: (
      <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
        <p>
          The <strong className="text-foreground">Store Assets</strong> page lists every physical item
          owned by the charity store. Each asset record tracks its category, total quantity, available
          quantity, and home location.
        </p>
        <h4 className="font-semibold text-foreground mt-4">Adding an asset</h4>
        <ol className="space-y-1 ml-4 list-decimal">
          <li>Click <strong className="text-foreground">Add Asset</strong> (admin) or request an admin to create one.</li>
          <li>Fill in the name, category, total quantity, and assign a location.</li>
          <li>Save — the asset will immediately appear in the table.</li>
        </ol>
        <h4 className="font-semibold text-foreground mt-4">Editing &amp; deleting</h4>
        <p>
          Use the action menu on any row to edit details or delete the asset. Assets with outstanding
          withdrawals cannot be deleted until all items are returned.
        </p>
        <h4 className="font-semibold text-foreground mt-4">Availability</h4>
        <p>
          <strong className="text-foreground">Available</strong> quantity updates automatically when
          withdrawals are created or returned. You never need to adjust it manually.
        </p>
        <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-md p-3 mt-2">
          <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="text-amber-700 dark:text-amber-400">
            Assets shown in <strong>red</strong> have zero available units — no more withdrawals can be
            created for them until existing ones are returned.
          </p>
        </div>
      </div>
    ),
  },
  {
    id: 'fetes',
    title: 'Fete Events',
    icon: Tent,
    content: (
      <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
        <p>
          Fete events represent charity sale events that assets are sent to. Each fete has a name,
          date, location, and a status (<em>upcoming</em>, <em>active</em>, or <em>completed</em>).
        </p>
        <h4 className="font-semibold text-foreground mt-4">Creating a fete</h4>
        <ol className="space-y-1 ml-4 list-decimal">
          <li>Click <strong className="text-foreground">New Fete</strong>.</li>
          <li>Enter the event name, date, and select a location.</li>
          <li>The fete starts in <em>upcoming</em> status.</li>
        </ol>
        <h4 className="font-semibold text-foreground mt-4">Status lifecycle</h4>
        <div className="space-y-2">
          <ManualRow label="Upcoming" description="Event is planned but not yet running. Assets can be pre-withdrawn to it." />
          <ManualRow label="Active" description="Event is currently running. This is the normal state while assets are in use." />
          <ManualRow label="Completed" description="Event has ended. All assets should have been returned before marking complete." />
        </div>
        <p>
          You can change a fete's status at any time using the actions menu on the fete row.
        </p>
      </div>
    ),
  },
  {
    id: 'withdrawals',
    title: 'Withdrawals',
    icon: ArrowUpFromLine,
    content: (
      <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
        <p>
          Withdrawals track the movement of assets out of storage to a fete (or general use) and
          their return. Every withdrawal records who took the item, when, and how many units.
        </p>
        <h4 className="font-semibold text-foreground mt-4">Creating a withdrawal</h4>
        <ol className="space-y-1 ml-4 list-decimal">
          <li>Click <strong className="text-foreground">New Withdrawal</strong>.</li>
          <li>Select the asset, specify quantity, and optionally link it to a fete.</li>
          <li>Submit — the asset's available quantity decreases immediately.</li>
        </ol>
        <h4 className="font-semibold text-foreground mt-4">Returning items</h4>
        <div className="flex items-start gap-2 mt-1">
          <RotateCcw className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
          <p>
            On an open withdrawal row, click <strong className="text-foreground">Return</strong> to mark
            the items as back in storage. The available quantity is restored automatically.
          </p>
        </div>
        <h4 className="font-semibold text-foreground mt-4">Filtering withdrawals</h4>
        <p>
          Use the <Filter className="inline w-3.5 h-3.5 mx-0.5" /> filter controls at the top of the
          page to narrow by status (<em>out</em> / <em>returned</em>), fete, or asset name.
        </p>
      </div>
    ),
  },
  {
    id: 'locations',
    title: 'Locations',
    icon: MapPin,
    adminOnly: true,
    content: (
      <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
        <p>
          Locations represent the physical places where assets are stored or events are held (e.g.
          storerooms, church halls, community centres). Assets and fetes are both linked to a location.
        </p>
        <h4 className="font-semibold text-foreground mt-4">Managing locations</h4>
        <ol className="space-y-1 ml-4 list-decimal">
          <li>Click <strong className="text-foreground">Add Location</strong>.</li>
          <li>Enter a name and optional address / notes.</li>
          <li>Locations become available in asset and fete dropdowns immediately.</li>
        </ol>
        <p>
          Deleting a location is only possible when no assets or fetes are currently linked to it.
        </p>
      </div>
    ),
  },
  {
    id: 'users',
    title: 'Users',
    icon: Users,
    adminOnly: true,
    content: (
      <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
        <p>
          The Users section lets admins manage who can access Fete Store Manager and what role they hold.
        </p>
        <h4 className="font-semibold text-foreground mt-4">Roles</h4>
        <div className="space-y-2">
          <ManualRow label="Volunteer" description="Can view and create assets, fetes, and withdrawals. Cannot access Locations or Users pages." />
          <ManualRow
            label={<span className="flex items-center gap-1"><Shield className="w-3.5 h-3.5 text-primary" /> Admin</span>}
            description="Full access to all pages including user and location management."
          />
        </div>
        <h4 className="font-semibold text-foreground mt-4">Adding a user</h4>
        <ol className="space-y-1 ml-4 list-decimal">
          <li>Click <strong className="text-foreground">Add User</strong>.</li>
          <li>Enter their name, username, password, and assign a role.</li>
          <li>Share the credentials with the new team member so they can log in.</li>
        </ol>
        <p>
          You can edit a user's role or reset their password at any time from the actions menu.
        </p>
      </div>
    ),
  },
  {
    id: 'tips',
    title: 'Tips &amp; Shortcuts',
    icon: Search,
    content: (
      <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
        <div className="space-y-2">
          <ManualRow label="Search tables" description="Use the search bar at the top of each table to filter rows by name or keyword in real time." />
          <ManualRow label="Sort columns" description="Click any column header to toggle ascending / descending sort." />
          <ManualRow label="Mobile use" description="Tap the ☰ menu icon at the top-left on small screens to open the navigation sidebar." />
          <ManualRow label="Sign out" description="Click 'Sign Out' at the bottom of the sidebar to end your session securely." />
        </div>
      </div>
    ),
  },
]

function ManualRow({
  label,
  description,
}: {
  label: React.ReactNode
  description: string
}) {
  return (
    <div className="flex gap-3">
      <div className="w-32 flex-shrink-0 font-medium text-foreground">{label}</div>
      <div className="flex-1">{description}</div>
    </div>
  )
}

function AccordionSection({ section }: { section: Section }) {
  const [open, setOpen] = useState(false)
  const Icon = section.icon

  return (
    <Card className="overflow-hidden">
      <button
        className="w-full text-left"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
      >
        <CardHeader className="py-4 px-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Icon className="w-4 h-4 text-primary flex-shrink-0" />
              <CardTitle className="text-base font-semibold">
                {section.title}
                {section.adminOnly && (
                  <span className="ml-2 text-xs font-normal text-muted-foreground border border-border rounded px-1.5 py-0.5">
                    Admin only
                  </span>
                )}
              </CardTitle>
            </div>
            {open
              ? <ChevronDown className="w-4 h-4 text-muted-foreground" />
              : <ChevronRight className="w-4 h-4 text-muted-foreground" />
            }
          </div>
        </CardHeader>
      </button>
      {open && (
        <CardContent className="px-5 pb-5 pt-0 border-t border-border">
          <div className="pt-4">{section.content}</div>
        </CardContent>
      )}
    </Card>
  )
}

export default function HelpPage() {
  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Help &amp; Manual</h1>
        <p className="text-muted-foreground mt-1">
          Everything you need to know about using Fete Store Manager.
        </p>
      </div>

      <div className="space-y-3">
        {SECTIONS.map(section => (
          <AccordionSection key={section.id} section={section} />
        ))}
      </div>
    </div>
  )
}
