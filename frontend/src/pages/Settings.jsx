/**
 * LogHawk – Settings Page
 *
 * Provides analyst profile information overview (including creation date),
 * a profile update form (Username/Email), and a secure password change form
 * that validates complexity rules in real-time.
 */

import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'
import useDocumentTitle from '../hooks/useDocumentTitle'
import './Settings.css'
import './ResetPassword.css' // Reuse checklist styling for password changes

function Settings() {
  useDocumentTitle('Settings')
  const { user, updateUserProfile } = useAuth()
  const [profileUsername, setProfileUsername] = useState('')
  const [profileEmail, setProfileEmail] = useState('')
  
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  
  const [profileError, setProfileError] = useState('')
  const [profileSuccess, setProfileSuccess] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState('')
  
  const [profileLoading, setProfileLoading] = useState(false)
  const [passwordLoading, setLoading] = useState(false)

  // Real-time password strength validation rules state
  const [checks, setChecks] = useState({
    length: false,
    uppercase: false,
    lowercase: false,
    number: false,
    special: false
  })

  // System stats state
  const [sysInfo, setSysInfo] = useState({
    status: 'loading...',
    version: '1.0.0',
    uptime: 0,
  })

  const [accountCreatedDate, setAccountCreatedDate] = useState('')

  // Sync inputs with user context
  useEffect(() => {
    if (user) {
      setProfileUsername(user.username || user.name || '')
      setProfileEmail(user.email || '')
      if (user.createdAt) {
        setAccountCreatedDate(new Date(user.createdAt).toLocaleDateString('en-US', {
          year: 'numeric', month: 'long', day: 'numeric'
        }))
      }
    }
  }, [user])

  // Real-time password verification hook
  useEffect(() => {
    setChecks({
      length: newPassword.length >= 8,
      uppercase: /[A-Z]/.test(newPassword),
      lowercase: /[a-z]/.test(newPassword),
      number: /[0-9]/.test(newPassword),
      special: /[!@#$%^&*(),.?":{}|<>]/.test(newPassword)
    })
  }, [newPassword])

  // Fetch health check and profile on mount
  useEffect(() => {
    const fetchSystemAndProfile = async () => {
      try {
        const [healthRes, profileRes] = await Promise.all([
          api.get('/api/health'),
          api.get('/api/auth/profile')
        ])
        setSysInfo({
          status: healthRes.data.status,
          version: healthRes.data.version,
          uptime: healthRes.data.uptime,
        })
        if (profileRes.data?.createdAt) {
          setAccountCreatedDate(new Date(profileRes.data.createdAt).toLocaleDateString('en-US', {
            year: 'numeric', month: 'long', day: 'numeric'
          }))
        }
      } catch (err) {
        setSysInfo(prev => ({ ...prev, status: 'error' }))
      }
    }
    fetchSystemAndProfile()
  }, [])

  // Format uptime to string
  const formatUptime = (seconds) => {
    if (!seconds || isNaN(seconds)) return '0s'
    const d = Math.floor(seconds / (3600 * 24))
    const h = Math.floor((seconds % (3600 * 24)) / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = Math.floor(seconds % 60)

    const dDisplay = d > 0 ? `${d}d ` : ''
    const hDisplay = h > 0 ? `${h}h ` : ''
    const mDisplay = m > 0 ? `${m}m ` : ''
    const sDisplay = `${s}s`
    return dDisplay + hDisplay + mDisplay + sDisplay
  }

  // Handle Profile Info Update (Username & Email)
  const handleProfileUpdate = async (e) => {
    e.preventDefault()
    setProfileError('')
    setProfileSuccess('')

    if (!profileUsername || !profileEmail) {
      setProfileError('Username and Email are required')
      return
    }

    setProfileLoading(true)
    try {
      await updateUserProfile(profileUsername, profileEmail)
      setProfileSuccess('Profile information updated successfully!')
    } catch (err) {
      console.error(err)
      setProfileError(err.response?.data?.message || 'Failed to update profile info')
    } finally {
      setProfileLoading(false)
    }
  }

  // Handle password change submit
  const handlePasswordChange = async (e) => {
    e.preventDefault()
    setPasswordError('')
    setPasswordSuccess('')

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError('All fields are required')
      return
    }

    // Complexity checks
    const allPassed = Object.values(checks).every(val => val === true)
    if (!allPassed) {
      setPasswordError('New password does not fulfill security requirements.')
      return
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirmation do not match')
      return
    }

    setLoading(true)
    try {
      await api.patch('/api/auth/me/password', {
        currentPassword,
        newPassword,
      })
      setPasswordSuccess('Password changed successfully!')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      console.error(err)
      setPasswordError(err.response?.data?.message || 'Failed to update password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="settings-page" id="settings-page">
      {/* Page Header */}
      <div className="settings-header">
        <h1 className="settings-title">System Settings</h1>
        <p className="settings-desc">Manage your profile details, update credentials, and view system status.</p>
      </div>

      <div className="settings-grid">
        {/* Left Column: User Profile Overview & Update form */}
        <div className="settings-card glass-card">
          <div className="card-header-row">
            <span className="card-icon">👤</span>
            <h2>User Profile</h2>
          </div>
          
          <form className="settings-form" onSubmit={handleProfileUpdate} style={{ marginBottom: '1.5rem' }}>
            {profileError && <div className="settings-error-alert">{profileError}</div>}
            {profileSuccess && <div className="settings-success-alert">{profileSuccess}</div>}

            <div className="form-group-item">
              <label htmlFor="profileUsername">Username</label>
              <input
                type="text"
                id="profileUsername"
                value={profileUsername}
                onChange={(e) => setProfileUsername(e.target.value)}
                placeholder="analyst_name"
                required
              />
            </div>

            <div className="form-group-item">
              <label htmlFor="profileEmail">Email Address</label>
              <input
                type="email"
                id="profileEmail"
                value={profileEmail}
                onChange={(e) => setProfileEmail(e.target.value)}
                placeholder="analyst@loghawk.io"
                required
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={profileLoading}
              id="save-profile-btn"
              style={{ width: '100%', marginTop: '0.5rem' }}
            >
              {profileLoading ? 'Saving Profile...' : 'Save Profile'}
            </button>
          </form>

          <div className="profile-details-list" style={{ borderTop: '1px solid var(--color-border)', paddingTop: '1.25rem' }}>
            <div className="profile-detail-row">
              <span className="profile-label">Designated Role</span>
              <span className="profile-value badge-role">{user?.role || 'SOC Analyst'}</span>
            </div>
            <div className="profile-detail-row">
              <span className="profile-label">Account Created</span>
              <span className="profile-value">{accountCreatedDate || 'N/A'}</span>
            </div>
            <div className="profile-detail-row">
              <span className="profile-label">Account Status</span>
              <span className="profile-value badge-status">Active</span>
            </div>
          </div>
        </div>

        {/* Middle Column: Change Password */}
        <div className="settings-card glass-card">
          <div className="card-header-row">
            <span className="card-icon">🔑</span>
            <h2>Change Password</h2>
          </div>
          
          <form className="settings-form" onSubmit={handlePasswordChange}>
            {passwordError && <div className="settings-error-alert">{passwordError}</div>}
            {passwordSuccess && <div className="settings-success-alert">{passwordSuccess}</div>}

            <div className="form-group-item">
              <label htmlFor="currentPassword">Current Password</label>
              <input
                type="password"
                id="currentPassword"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>

            <div className="form-group-item">
              <label htmlFor="newPassword">New Password</label>
              <input
                type="password"
                id="newPassword"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>

            {/* Real-time Password checklist */}
            {newPassword && (
              <div className="password-requirements-list" style={{ marginBottom: '1rem' }}>
                <div className="password-requirements-title">Password Strength Rules:</div>
                <div className={`password-requirement-item ${checks.length ? 'met' : ''}`}>
                  <span className="requirement-icon">{checks.length ? '✓' : '•'}</span>
                  <span>Minimum 8 characters</span>
                </div>
                <div className={`password-requirement-item ${checks.uppercase ? 'met' : ''}`}>
                  <span className="requirement-icon">{checks.uppercase ? '✓' : '•'}</span>
                  <span>At least one uppercase letter (A-Z)</span>
                </div>
                <div className={`password-requirement-item ${checks.lowercase ? 'met' : ''}`}>
                  <span className="requirement-icon">{checks.lowercase ? '✓' : '•'}</span>
                  <span>At least one lowercase letter (a-z)</span>
                </div>
                <div className={`password-requirement-item ${checks.number ? 'met' : ''}`}>
                  <span className="requirement-icon">{checks.number ? '✓' : '•'}</span>
                  <span>At least one number (0-9)</span>
                </div>
                <div className={`password-requirement-item ${checks.special ? 'met' : ''}`}>
                  <span className="requirement-icon">{checks.special ? '✓' : '•'}</span>
                  <span>At least one special character (!@#$ etc)</span>
                </div>
              </div>
            )}

            <div className="form-group-item">
              <label htmlFor="confirmPassword">Confirm New Password</label>
              <input
                type="password"
                id="confirmPassword"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              className="btn btn-save-password"
              disabled={passwordLoading}
              id="submit-password-change-btn"
            >
              {passwordLoading ? 'Updating...' : 'Update Password'}
            </button>
          </form>
        </div>

        {/* Right Column: System Status */}
        <div className="settings-card glass-card">
          <div className="card-header-row">
            <span className="card-icon">🖥️</span>
            <h2>System & API Info</h2>
          </div>
          <div className="system-info-list">
            <div className="system-info-row">
              <span className="system-label">Platform Name</span>
              <span className="system-value">LogHawk SIEM</span>
            </div>
            <div className="system-info-row">
              <span className="system-label">Software Version</span>
              <span className="system-value monospace-text">v{sysInfo.version}</span>
            </div>
            <div className="system-info-row">
              <span className="system-label">API Health Status</span>
              <span className={`system-value badge-health-${sysInfo.status.toLowerCase().replace(' ', '_')}`}>
                {sysInfo.status.toUpperCase()}
              </span>
            </div>
            <div className="system-info-row">
              <span className="system-label">API Server Uptime</span>
              <span className="system-value monospace-text">{formatUptime(sysInfo.uptime)}</span>
            </div>
            <div className="system-info-row">
              <span className="system-label">Database Status</span>
              <span className="system-value badge-health-operational">CONNECTED</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Settings
