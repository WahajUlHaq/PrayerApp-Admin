import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import './Header.css'

export default function Header() {
  const [open, setOpen] = useState(false)

  return (
    <header className="app-header">
      <div className="header-inner">
        <div className="brand">
          <div className="brand-mark">PA</div>
          <div className="brand-text">
            <div className="brand-title">Prayer App Admin</div>
            <div className="brand-subtitle">Masjid settings</div>
          </div>
        </div>

        <button
          type="button"
          className="nav-toggle"
          aria-label={open ? 'Close navigation' : 'Open navigation'}
          aria-expanded={open}
          onClick={() => setOpen(v => !v)}
        >
          <span className="nav-toggle-bar" />
          <span className="nav-toggle-bar" />
          <span className="nav-toggle-bar" />
        </button>

        <nav className={open ? 'nav nav-open' : 'nav'}>
          <NavLink
            to="/masjid-config"
            className={({ isActive }) => (isActive ? 'nav-link nav-link-active' : 'nav-link')}
            onClick={() => setOpen(false)}
          >
            Masjid Config
          </NavLink>
          <NavLink
            to="/iqamaah-times"
            className={({ isActive }) => (isActive ? 'nav-link nav-link-active' : 'nav-link')}
            onClick={() => setOpen(false)}
          >
            Iqamaah Times
          </NavLink>
          <NavLink
            to="/page-management"
            className={({ isActive }) => (isActive ? 'nav-link nav-link-active' : 'nav-link')}
            onClick={() => setOpen(false)}
          >
            Page Management
          </NavLink>
          {/* <NavLink
            to="/coming-soon"
            className={({ isActive }) => (isActive ? 'nav-link nav-link-active' : 'nav-link')}
            onClick={() => setOpen(false)}
          >
            Coming Soon
          </NavLink> */}
        </nav>
      </div>
    </header>
  )
}
