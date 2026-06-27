/**
 * LogHawk – Sidebar Component
 *
 * Left navigation panel for the SOC dashboard.
 * Supports collapsible icon-only mode (persisted in localStorage).
 * Accepts collapsed/onToggle props from DashboardLayout.
 */

import { NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useState, useEffect } from 'react'
import api from '../services/api'
import './Sidebar.css'

// Monitoring section items
const monitoringItems = [
  {
    path: '/',
    label: 'Dashboard',
    end: true,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    path: '/logs',
    label: 'Logs',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    ),
  },
  {
    path: '/detection',
    label: 'Threat Detection',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <path d="M12 8v4" />
        <path d="M12 16h.01" />
      </svg>
    ),
  },
  {
    path: '/alerts',
    label: 'Alerts',
    isAlerts: true,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
    ),
  },
]

// Incident Response section items
const incidentItems = [
  {
    path: '/incidents',
    label: 'Incident Response',
    isIncidents: true,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
  },
  {
    path: '/blocked-assets',
    label: 'Blocked Assets',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
      </svg>
    ),
  },
]

// Bottom section items
const bottomNavItems = [
  {
    path: '/settings',
    label: 'Settings',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="3" />
        <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
      </svg>
    ),
  },
]


function Sidebar({ collapsed, onToggle }) {
  const { user, logout } = useAuth()
  const [openAlerts, setOpenAlerts] = useState(0)
  const [openIncidents, setOpenIncidents] = useState(0)

  // Fetch live counts for alerts and incidents
  useEffect(() => {
    const fetchCounts = async () => {
      try {
        const [alertsRes, incidentsRes] = await Promise.all([
          api.get('/api/alerts/stats'),
          api.get('/api/incidents/stats')
        ])
        setOpenAlerts(alertsRes.data.open || 0)
        setOpenIncidents(incidentsRes.data.open || 0)
      } catch {
        // Silently ignore — sidebar badges are non-critical
      }
    }
    fetchCounts()
    const interval = setInterval(fetchCounts, 60000)
    return () => clearInterval(interval)
  }, [])

  return (
    <aside
      className={`sidebar ${collapsed ? 'sidebar-collapsed' : ''}`}
      id="main-sidebar"
    >
      {/* Collapse toggle button */}
      <button
        className="sidebar-toggle"
        onClick={onToggle}
        id="sidebar-toggle-btn"
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          {collapsed ? (
            <polyline points="9 18 15 12 9 6" />
          ) : (
            <polyline points="15 18 9 12 15 6" />
          )}
        </svg>
      </button>

      {/* Main navigation */}
      <nav className="sidebar-nav" aria-label="Main navigation">
        <div className="nav-section">
          <span className="nav-section-label">Monitoring</span>
          {monitoringItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.end}
              className={({ isActive }) =>
                `nav-item ${isActive ? 'nav-item-active' : ''}`
              }
              title={collapsed ? item.label : undefined}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
              {item.isAlerts && openAlerts > 0 && !collapsed && (
                <span className="nav-badge nav-badge-live">{openAlerts > 99 ? '99+' : openAlerts}</span>
              )}
            </NavLink>
          ))}
        </div>

        <div className="nav-section">
          <span className="nav-section-label">Incident Response</span>
          {incidentItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `nav-item ${isActive ? 'nav-item-active' : ''}`
              }
              title={collapsed ? item.label : undefined}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
              {item.isIncidents && openIncidents > 0 && !collapsed && (
                <span className="nav-badge nav-badge-live" style={{ backgroundColor: 'var(--color-warning)', color: '#000' }}>
                  {openIncidents > 99 ? '99+' : openIncidents}
                </span>
              )}
            </NavLink>
          ))}
        </div>
      </nav>

      {/* Bottom section — settings + logout */}
      <div className="sidebar-bottom">
        <div className="nav-section">
          {bottomNavItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `nav-item ${isActive ? 'nav-item-active' : ''}`
              }
              title={collapsed ? item.label : undefined}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
            </NavLink>
          ))}

          {/* Logout button */}
          <button
            className="nav-item nav-item-logout"
            onClick={logout}
            id="sidebar-logout-btn"
            title={collapsed ? 'Logout' : undefined}
          >
            <span className="nav-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </span>
            <span className="nav-label">Logout</span>
          </button>
        </div>

        {/* User info + system status */}
        {!collapsed && (
          <div className="sidebar-user-info">
            <div className="sidebar-avatar">
              {user?.name?.charAt(0)?.toUpperCase() || 'A'}
            </div>
            <div className="sidebar-user-text">
              <span className="sidebar-user-name">{user?.name || 'Analyst'}</span>
              <div className="sidebar-status">
                <span className="status-dot status-online"></span>
                <span className="sidebar-status-text">Online</span>
                <span className="sidebar-version">v1.0.0</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  )
}

export default Sidebar
