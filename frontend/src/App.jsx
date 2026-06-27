import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import DashboardLayout from './layouts/DashboardLayout'
import Login from './pages/Login'
import Register from './pages/Register'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import Dashboard from './pages/Dashboard'
import Logs from './pages/Logs'
import Alerts from './pages/Alerts'
import IncidentResponse from './pages/IncidentResponse'
import Settings from './pages/Settings'
import ThreatDetection from './pages/ThreatDetection'
import BlockedAssets from './pages/BlockedAssets'

// Wraps any route that requires the user to be logged in.
// Shows a loading state while the auth session is being restored from localStorage.
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        color: 'var(--color-accent)',
        fontSize: '1.25rem',
      }}>
        <div className="animate-pulse-glow" style={{
          padding: '1rem 2rem',
          borderRadius: 'var(--radius-md)',
          background: 'var(--color-bg-secondary)',
        }}>
          Initializing LogHawk...
        </div>
      </div>
    )
  }

  return user ? children : <Navigate to="/login" replace />
}

// Wraps any public route (like Login/Register) that should not be visible when logged in.
function PublicOnlyRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        color: 'var(--color-accent)',
        fontSize: '1.25rem',
      }}>
        <div className="animate-pulse-glow" style={{
          padding: '1rem 2rem',
          borderRadius: 'var(--radius-md)',
          background: 'var(--color-bg-secondary)',
        }}>
          Initializing LogHawk...
        </div>
      </div>
    )
  }

  return user ? <Navigate to="/" replace /> : children
}

function App() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<PublicOnlyRoute><Login /></PublicOnlyRoute>} />
      <Route path="/register" element={<PublicOnlyRoute><Register /></PublicOnlyRoute>} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      {/* Protected routes — all rendered inside the DashboardLayout shell */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="logs" element={<Logs />} />
        <Route path="alerts" element={<Alerts />} />
        <Route path="detection" element={<ThreatDetection />} />
        <Route path="incidents" element={<IncidentResponse />} />
        <Route path="blocked-assets" element={<BlockedAssets />} />
        <Route path="settings" element={<Settings />} />
      </Route>

      {/* Catch-all: redirect unknown paths to dashboard */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
