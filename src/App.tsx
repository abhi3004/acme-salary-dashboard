import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { Link, NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import AddEmployee from './pages/AddEmployee'
import Employee from './pages/Employee'
import Icon from './components/Icon'

const PermissionGenerator = lazy(() => import('./pages/PermissionGenerator'))

export default function App() {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuButton = useRef<HTMLButtonElement>(null)
  const location = useLocation()

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
          <NavLink to="/" end><Icon name="grid" /><span>Dashboard</span><Icon name="chevron" size={14} className="nav-chevron" /></NavLink>
          <NavLink to="/employees" className={({ isActive }) => isActive || location.pathname.startsWith('/employee/') ? 'active' : undefined}><Icon name="people" /><span>Employees</span></NavLink>
          <NavLink to="/add"><Icon name="upload" /><span>Add employees</span></NavLink>
          <NavLink to="/permissions"><Icon name="document" /><span>Permission Generator</span></NavLink>
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
            <div><strong>Acme workspace</strong><span>People & payroll</span></div>
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
          <div className="header-end"><span className="header-workspace"><span /> HR workspace</span><div className="header-avatar" aria-label="Acme workspace">AC</div></div>
        </header>
        <main id="main-content" key={location.pathname} tabIndex={-1}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/employees" element={<Dashboard directory />} />
            <Route path="/employee/:id" element={<Employee />} />
            <Route path="/add" element={<AddEmployee />} />
            <Route path="/permissions" element={<Suspense fallback={<section className="panel employee-load-state">Loading Permission Generator…</section>}><PermissionGenerator /></Suspense>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <footer className="app-footer"><span>Acme · People, made simple.</span><span>Salary management workspace</span></footer>
        </main>
      </div>
    </div>
  )
}
