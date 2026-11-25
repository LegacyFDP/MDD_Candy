import { useEffect, useState } from 'react'
import { Routes, Route, Link, useLocation, Navigate } from 'react-router-dom'
import Login, { type AppUser } from './pages/Login'
import Dashboard from './pages/Dashboard'
import AssetsPage from './pages/AssetsPage'
import AssetCategoriesPage from './pages/AssetCategoriesPage'
import FetesPage from './pages/FetesPage'
import WithdrawalsPage from './pages/WithdrawalsPage'
import UsersPage from './pages/UsersPage'
import PrintListsPage from './pages/PrintListsPage'
import LocationsPage from './pages/LocationsPage'
import VolunteersPage from './pages/VolunteersPage'
import HelpPage from './pages/HelpPage'
import { Button } from './lib/shadcn/button'
import { TooltipProvider } from './lib/shadcn/tooltip'
import { setSessionExpiredHandler, signOut } from './hooks/backend/fete'
import { isAdmin, roleLabel } from './lib/roles'
import {
  LayoutDashboard, Package, Tent, ArrowUpFromLine,
  Users, Printer, MapPin, LogOut, Menu, X, Shield, HelpCircle, Tag
} from 'lucide-react'

const NAV_ITEMS = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard, adminOnly: false },
  { path: '/assets', label: 'Store Assets', icon: Package, adminOnly: false },
  { path: '/asset-categories', label: 'Asset Categories', icon: Tag, adminOnly: true },
  { path: '/fetes', label: 'Fete Events', icon: Tent, adminOnly: false },
  { path: '/volunteers', label: 'Volunteer Rota', icon: Users, adminOnly: true },
  { path: '/withdrawals', label: 'Withdrawals', icon: ArrowUpFromLine, adminOnly: false },
  { path: '/locations', label: 'Locations', icon: MapPin, adminOnly: true },
  { path: '/users', label: 'People', icon: Users, adminOnly: true },
  { path: '/print-lists', label: 'Print Lists', icon: Printer, adminOnly: true },
  { path: '/help', label: 'Help', icon: HelpCircle, adminOnly: false },
]

export default function App() {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // When the server reports the sign-in has expired, go back to the login page.
  useEffect(() => {
    setSessionExpiredHandler(() => setCurrentUser(null))
    return () => setSessionExpiredHandler(null)
  }, [])

  function handleSignOut() {
    void signOut()
    setCurrentUser(null)
  }

  if (!currentUser) {
    return <Login onLogin={setCurrentUser} />
  }

  return (
    <TooltipProvider>
    <div className="app-shell flex h-screen bg-background overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`app-sidebar
        fixed lg:static inset-y-0 left-0 z-30 w-60 bg-card border-r border-border
        flex flex-col transition-transform duration-200
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Logo */}
        <div className="p-4 border-b border-border flex items-center gap-2">
          <div className="bg-primary/10 p-1.5 rounded-md">
            <Tent className="w-5 h-5 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="font-bold text-sm leading-tight">Fete Store</p>
            <p className="text-xs text-muted-foreground">Charity Manager</p>
          </div>
          <button className="ml-auto lg:hidden" onClick={() => setSidebarOpen(false)}>
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {NAV_ITEMS.filter(item => !item.adminOnly || isAdmin(currentUser)).map(item => (
            <NavItem key={item.path} {...item} onNavigate={() => setSidebarOpen(false)} />
          ))}
        </nav>

        {/* User */}
        <div className="p-3 border-t border-border">
          <div className="flex items-center gap-2 px-2 py-1.5 mb-2">
            <div className={`p-1.5 rounded-full ${isAdmin(currentUser) ? 'bg-primary/10' : 'bg-muted'}`}>
              {isAdmin(currentUser)
                ? <Shield className="w-4 h-4 text-primary" />
                : <Users className="w-4 h-4 text-muted-foreground" />
              }
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{currentUser.name}</p>
              <p className="text-xs text-muted-foreground capitalize">{roleLabel(currentUser.role)}</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full flex items-center gap-2"
            onClick={handleSignOut}
          >
            <LogOut className="w-3 h-3" /> Sign Out
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <div className="app-content flex-1 flex flex-col overflow-hidden">
        {/* Mobile top bar */}
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 border-b border-border bg-card">
          <button onClick={() => setSidebarOpen(true)} aria-label="Open menu">
            <Menu className="w-5 h-5 text-foreground" />
          </button>
          <Tent className="w-5 h-5 text-primary" />
          <span className="font-semibold text-sm">Fete Store Manager</span>
        </header>

        <main className="app-main flex-1 overflow-y-auto">
          <Routes>
            <Route path="/" element={<Dashboard currentUser={currentUser} />} />
            <Route path="/assets" element={<AssetsPage currentUser={currentUser} />} />
            <Route path="/asset-categories" element={
              isAdmin(currentUser)
                ? <AssetCategoriesPage currentUser={currentUser} />
                : <Navigate to="/" replace />
            } />
            <Route path="/fetes" element={<FetesPage currentUser={currentUser} />} />
            <Route path="/volunteers" element={
              isAdmin(currentUser)
                ? <VolunteersPage currentUser={currentUser} />
                : <Navigate to="/" replace />
            } />
            <Route path="/withdrawals" element={<WithdrawalsPage currentUser={currentUser} />} />
            <Route path="/locations" element={<LocationsPage currentUser={currentUser} />} />
            <Route path="/users" element={
              isAdmin(currentUser)
                ? <UsersPage currentUser={currentUser} />
                : <Navigate to="/" replace />
            } />
            <Route path="/print-lists" element={
              isAdmin(currentUser)
                ? <PrintListsPage currentUser={currentUser} />
                : <Navigate to="/" replace />
            } />
            <Route path="/help" element={<HelpPage />} />
          </Routes>
        </main>
      </div>
    </div>
    </TooltipProvider>
  )
}

function NavItem({
  path, label, icon: Icon, onNavigate
}: {
  path: string; label: string; icon: React.ComponentType<{ className?: string }>
  adminOnly: boolean; onNavigate: () => void
}) {
  const location = useLocation()
  const isActive = location.pathname === path

  return (
    <Link
      to={path}
      onClick={onNavigate}
      className={`
        flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors
        ${isActive
          ? 'bg-primary text-primary-foreground font-medium'
          : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
        }
      `}
    >
      <Icon className="w-4 h-4 flex-shrink-0" />
      {label}
    </Link>
  )
}
