import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import AddEmployee from './pages/AddEmployee'

export default function App() {
  return (
    <div className="app">
      <header className="app-header">
        <span className="brand">Acme Salary Dashboard</span>
        <nav>
          <NavLink to="/" end>Dashboard</NavLink>
          <NavLink to="/add">Add Employee</NavLink>
        </nav>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/add" element={<AddEmployee />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  )
}
