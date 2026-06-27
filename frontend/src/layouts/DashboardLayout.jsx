/**
 * LogHawk – Dashboard Layout
 *
 * Main shell for all authenticated pages.
 * Manages the sidebar collapsed state here so both Navbar (hamburger)
 * and Sidebar (toggle button) can read and update it.
 */

import { Outlet } from 'react-router-dom'
import Navbar from '../components/Navbar'
import Sidebar from '../components/Sidebar'
import { useSidebarState } from '../hooks/useSidebarState'
import './DashboardLayout.css'

function DashboardLayout() {
  const { collapsed, toggle } = useSidebarState()

  return (
    <div className={`dashboard-layout ${collapsed ? 'sidebar-is-collapsed' : ''}`} id="dashboard-layout">
      <Navbar onMenuToggle={toggle} />
      <div className="dashboard-body">
        <Sidebar collapsed={collapsed} onToggle={toggle} />
        <main className="dashboard-content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default DashboardLayout
