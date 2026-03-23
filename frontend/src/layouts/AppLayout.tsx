import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Cloud, LayoutDashboard, Settings, LogOut, Menu, X } from 'lucide-react'
import { clsx } from 'clsx'

export default function AppLayout() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)

  const handleSignOut = async () => {
    await signOut()
    navigate('/')
  }

  const navItems = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/settings', icon: Settings, label: 'Settings' },
  ]

  const NavLinks = ({ onNavigate }: { onNavigate?: () => void }) => (
    <>
      {navItems.map(({ to, icon: Icon, label }) => (
        <NavLink
          key={to}
          to={to}
          onClick={onNavigate}
          className={({ isActive }) =>
            clsx(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
              isActive
                ? 'bg-sky-500/10 text-sky-400'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
            )
          }
        >
          <Icon className="w-4 h-4 flex-shrink-0" />
          {label}
        </NavLink>
      ))}
    </>
  )

  return (
    <div className="min-h-screen bg-zinc-950 flex">

      {/* ── Desktop Sidebar ── */}
      <aside className="hidden md:flex w-60 bg-zinc-900 border-r border-zinc-800 flex-col fixed h-full z-30">
        <div className="flex items-center gap-3 px-5 py-5 border-b border-zinc-800">
          <div className="w-8 h-8 rounded-lg bg-sky-500 flex items-center justify-center flex-shrink-0">
            <Cloud className="w-4 h-4 text-white" strokeWidth={2.5} />
          </div>
          <span className="text-white font-bold tracking-tight">ZippyCloud</span>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          <NavLinks />
        </nav>

        <div className="px-3 py-4 border-t border-zinc-800">
          <div className="px-3 py-2 mb-1">
            <p className="text-zinc-400 text-xs truncate">{user?.email}</p>
          </div>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-sm font-medium text-zinc-400 hover:text-red-400 hover:bg-red-400/10 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      </aside>

      {/* ── Mobile Header ── */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-40 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between px-4 h-14">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-sky-500 flex items-center justify-center flex-shrink-0">
            <Cloud className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />
          </div>
          <span className="text-white font-bold tracking-tight text-sm">ZippyCloud</span>
        </div>
        <button
          onClick={() => setMobileOpen(true)}
          className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>
      </header>

      {/* ── Mobile Drawer Overlay ── */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-50 flex"
          onClick={() => setMobileOpen(false)}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

          {/* Drawer */}
          <div
            className="relative ml-auto w-72 bg-zinc-900 border-l border-zinc-800 flex flex-col h-full shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            {/* Drawer header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-sky-500 flex items-center justify-center flex-shrink-0">
                  <Cloud className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />
                </div>
                <span className="text-white font-bold tracking-tight text-sm">ZippyCloud</span>
              </div>
              <button
                onClick={() => setMobileOpen(false)}
                className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Drawer nav */}
            <nav className="flex-1 px-3 py-4 space-y-1">
              <NavLinks onNavigate={() => setMobileOpen(false)} />
            </nav>

            {/* Drawer user */}
            <div className="px-3 py-4 border-t border-zinc-800">
              <div className="px-3 py-2 mb-1">
                <p className="text-zinc-500 text-xs">Signed in as</p>
                <p className="text-zinc-300 text-xs font-medium truncate mt-0.5">{user?.email}</p>
              </div>
              <button
                onClick={() => { setMobileOpen(false); handleSignOut() }}
                className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-sm font-medium text-zinc-400 hover:text-red-400 hover:bg-red-400/10 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Main Content ── */}
      <main className="flex-1 md:ml-60 min-h-screen pt-14 md:pt-0">
        <Outlet />
      </main>
    </div>
  )
}
