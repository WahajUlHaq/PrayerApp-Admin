import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useSocketReload } from '../hooks/useSocketReload'
import { fetchMasjidConfig } from '../services/api'
import './Header.css'

const ANNOUNCEMENT_DELIM = '|||' // unique delimiter for storing multiple announcements

export default function Header() {
  const [open, setOpen] = useState(false)
  const { isReloading, reloadMessage, reloadMessageType, notifyReload, isAnnouncing, notifyAnnounce } = useSocketReload()

  return (
    <>
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
            <button
              type="button"
              className="nav-link reload-button"
              onClick={async () => {
                setOpen(false)
                await notifyReload('Reload triggered manually')
              }}
              title="Reload connected clients"
              disabled={isReloading || isAnnouncing}
            >
              Reload Clients
            </button>
            <button
              type="button"
              className="nav-link reload-button"
              onClick={async () => {
                setOpen(false)
                try {
                  // Fetch current config to get announcements
                  const config = await fetchMasjidConfig()
                  const rawAnnouncements = String(config?.announcements || '')
                  
                  if (!rawAnnouncements) {
                    alert('No announcements configured. Please add announcements in Masjid Config first.')
                    return
                  }
                  
                  // Split announcements and join with bullet for display
                  const announcementText = rawAnnouncements
                    .split(ANNOUNCEMENT_DELIM)
                    .map(item => String(item || '').trim())
                    .filter(Boolean)
                    .join(' • ')
                  
                  if (!announcementText) {
                    alert('No announcements configured. Please add announcements in Masjid Config first.')
                    return
                  }
                  
                  await notifyAnnounce(announcementText)
                } catch (error) {
                  console.error('Error sending announcement:', error)
                  alert('Failed to send announcement: ' + (error.message || 'Unknown error'))
                }
              }}
              title="Send announcements to clients"
              disabled={isReloading || isAnnouncing}
            >
              {isAnnouncing ? 'Sending...' : 'Send Announcements'}
            </button>
          </nav>
        </div>
      </header>

      {/* Unified Message/Notification System */}
      {(reloadMessage || isReloading) && (
        <div className="main-container-message">
          <div className={`message ${isReloading ? 'info' : reloadMessageType}`}>
            <span className="message-text">
              {isReloading ? 'Executing operation and notifying clients...' : reloadMessage}
            </span>
          </div>
        </div>
      )}
    </>
  )
}
