import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { Link, NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import AddEmployee from './pages/AddEmployee'
import Employee from './pages/Employee'
import Icon from './components/Icon'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchCurrentUser, logout } from './api'
import Login from './pages/Login'
import Users from './pages/Users'
import AcceptInvitation from './pages/AcceptInvitation'
import Notifications from './pages/Notifications'

const PermissionGenerator = lazy(() => import('./pages/PermissionGenerator'))

export default function App() {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuButton = useRef<HTMLButtonElement>(null)
  const location = useLocation()
  const queryClient = useQueryClient()
  const session = useQuery({ queryKey: ['current-user'], queryFn: fetchCurrentUser, retry: false, staleTime: 60_000 })

  useEffect(() => {
    if (!menuOpen) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false)
        menuButton.current?.focus()
      }
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [menuOpen])

  if (location.pathname.startsWith('/accept-invitation/')) {
    return <Routes><Route path="/accept-invitation/:token" element={<AcceptInvitation />} /></Routes>
  }
  if (session.isPending) return <main className="auth-shell"><p>Loading workspace…</p></main>
  if (session.isError) return <Login onSuccess={() => queryClient.invalidateQueries({ queryKey: ['current-user'] })} />
  const user = session.data
  const can = (permission: string) => user.permissions.includes(permission as never)

  const date = new Intl.DateTimeFormat('en', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date())

  return (
    <div className={`app${menuOpen ? ' menu-open' : ''}`}>
      <a className="skip-link" href="#main-content">Skip to content</a>
      {menuOpen && <button className="sidebar-backdrop" aria-label="Close navigation" onClick={() => setMenuOpen(false)} />}
      <aside className="sidebar" id="sidebar" aria-label="Workspace sidebar">
        <Link to="/" className="brand" onClick={() => setMenuOpen(false)} aria-label="Acme home">
          <span className="brand-mark"><Icon name="wallet" size={23} /></span>
          <span>acme<span className="brand-dot">.</span></span>
        </Link>
        <div className="workspace-label">SALARY MANAGEMENT</div>
        <div className="nav-caption">WORKSPACE</div>
        <nav aria-label="Main navigation" onClick={() => setMenuOpen(false)}>
          {can('salary.read') && <NavLink to="/" end><Icon name="grid" /><span>Dashboard</span><Icon name="chevron" size={14} className="nav-chevron" /></NavLink>}
          {can('employee.read') && <NavLink to="/employees" className={({ isActive }) => isActive || location.pathname.startsWith('/employee/') ? 'active' : undefined}><Icon name="people" /><span>Employees</span></NavLink>}
          {can('employee.profile.update') && <NavLink to="/add"><Icon name="upload" /><span>Add employees</span></NavLink>}
          {can('salary.change.request') && <NavLink to="/permissions"><Icon name="document" /><span>Permission Generator</span></NavLink>}
          {can('user.manage') && <NavLink to="/users"><Icon name="people" /><span>Users</span></NavLink>}
          {can('audit.read') && <NavLink to="/notifications"><Icon name="bell" /><span>Notifications</span></NavLink>}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <span className="sidebar-note-icon"><Icon name="people" size={23} /></span>
            <strong>A growing team?</strong>
            <p>Bring your people together.<br />Import your employee list in one go.</p>
            <Link to="/add" onClick={() => setMenuOpen(false)}>Import employees <Icon name="arrow" size={16} /></Link>
          </div>
          <div className="workspace-profile">
            <span className="workspace-avatar">A</span>
            <div><strong>{user.name}</strong><span>{user.is_admin ? 'Administrator' : 'Workspace user'}</span></div>
            <span className="workspace-online" title="Current workspace" />
          </div>
        </div>
      </aside>
      <div className="app-body">
        <header className="app-header">
          <button ref={menuButton} type="button" className="icon-button mobile-menu" aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen} aria-controls="sidebar" onClick={() => setMenuOpen(!menuOpen)}>
            <Icon name={menuOpen ? 'close' : 'menu'} />
          </button>
          <div className="greeting"><strong>Welcome back!</strong><span>{date}</span></div>
          <div className="header-end"><span className="header-workspace"><span /> {user.email}</span>
            <button type="button" className="header-avatar" aria-label="Sign out" title="Sign out" onClick={async () => {
              await logout(); queryClient.setQueryData(['current-user'], undefined); await queryClient.invalidateQueries()
            }}>{user.name.slice(0, 2).toUpperCase()}</button></div>
        </header>
        <main id="main-content" key={location.pathname} tabIndex={-1}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/employees" element={<Dashboard directory />} />
            <Route path="/employee/:id" element={<Employee />} />
            <Route path="/add" element={<AddEmployee currentUserEmail={user.email} />} />
            <Route path="/permissions" element={<Suspense fallback={<section className="panel employee-load-state">Loading Permission Generator…</section>}><PermissionGenerator /></Suspense>} />
            <Route path="/users" element={can('user.manage') ? <Users /> : <Navigate to="/" replace />} />
            <Route path="/notifications" element={can('audit.read')
              ? <Notifications userId={user.id} canViewEmployees={can('employee.read')} />
              : <section className="panel audit-state" role="alert"><h1>Access restricted</h1><p>You need audit access to view notifications.</p></section>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <footer className="app-footer"><span>Acme · People, made simple.</span><span>Salary management workspace</span></footer>
        </main>
      </div>
    </div>
  )
}
