/**
 * LogHawk – Navbar Component
 *
 * Top navigation bar. On desktop it shows brand + search + user info.
 * On mobile, shows a hamburger button that toggles the sidebar.
 * Receives onMenuToggle from DashboardLayout.
 */

import { useAuth } from '../context/AuthContext'
import './Navbar.css'

function Navbar({ onMenuToggle }) {
  const { user, logout } = useAuth()

  return (
    <nav className="navbar" id="main-navbar">
      {/* Mobile hamburger — only visible below 768px */}
      <button
        className="navbar-hamburger"
        onClick={onMenuToggle}
        id="mobile-menu-btn"
        aria-label="Toggle navigation"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      {/* Brand */}
      <div className="navbar-brand">
        <span className="navbar-logo">🦅</span>
        <span className="navbar-title">LogHawk</span>
        <span className="navbar-badge">SIEM</span>
      </div>

      {/* Search — hidden on mobile */}
      <div className="navbar-search">
        <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8" />
          <path d="M21 21l-4.35-4.35" />
        </svg>
        <input
          type="text"
          placeholder="Search logs, alerts, incidents..."
          className="search-input"
          id="global-search"
        />
        <kbd className="search-kbd">⌘K</kbd>
      </div>

      {/* Right side actions */}
      <div className="navbar-actions">
        {/* Notification bell */}
        <button className="navbar-icon-btn" id="notifications-btn" title="Notifications">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          <span className="notification-dot"></span>
        </button>

        {/* User profile */}
        <div className="navbar-user">
          <div className="user-avatar" title={user?.name}>
            {user?.name?.charAt(0)?.toUpperCase() || 'A'}
          </div>
          <div className="user-info">
            <span className="user-name">{user?.name || 'Analyst'}</span>
            <span className="user-role">SOC Analyst</span>
          </div>
          {/* Logout — desktop only; sidebar has its own logout button */}
          <button
            className="btn-logout"
            onClick={logout}
            id="logout-btn"
            title="Logout"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </div>
      </div>
    </nav>
  )
}

export default Navbar
