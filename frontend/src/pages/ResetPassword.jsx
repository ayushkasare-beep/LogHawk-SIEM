/**
 * LogHawk – Reset Password Page
 *
 * Dedicated password reset screen. Validates query tokens, enforces password
 * strength requirements via real-time checklist indicators, and updates credentials securely.
 */

import { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import useDocumentTitle from '../hooks/useDocumentTitle'
import './Auth.css'
import './ResetPassword.css'

function ResetPassword() {
  useDocumentTitle('Reset Password')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  
  const { resetPassword } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  // Query parameter extraction
  const queryParams = new URLSearchParams(location.search)
  const token = queryParams.get('token')
  const email = queryParams.get('email')

  // Real-time password strength validation rules state
  const [checks, setChecks] = useState({
    length: false,
    uppercase: false,
    lowercase: false,
    number: false,
    special: false
  })

  useEffect(() => {
    setChecks({
      length: newPassword.length >= 8,
      uppercase: /[A-Z]/.test(newPassword),
      lowercase: /[a-z]/.test(newPassword),
      number: /[0-9]/.test(newPassword),
      special: /[!@#$%^&*(),.?":{}|<>]/.test(newPassword)
    })
  }, [newPassword])

  // Check if token and email query parameters are missing
  useEffect(() => {
    if (!token || !email) {
      setError('Invalid recovery link. Please request a new password reset link.')
    }
  }, [token, email])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!token || !email) {
      setError('Missing reset token or email address.')
      return
    }

    // Double check password matches
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    // Verify all complexity checks pass
    const allPassed = Object.values(checks).every(val => val === true)
    if (!allPassed) {
      setError('Password does not fulfill security requirements.')
      return
    }

    setLoading(true)

    try {
      await resetPassword(email, token, newPassword, confirmPassword)
      setSuccess('Your password has been reset successfully!')
      setNewPassword('')
      setConfirmPassword('')
      
      // Auto redirect to login after 3 seconds
      setTimeout(() => {
        navigate('/login')
      }, 3000)
    } catch (err) {
      console.error(err)
      setError(err.response?.data?.message || 'Failed to reset password. Link may be expired.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page" id="reset-password-page">
      <div className="auth-bg-grid"></div>
      <div className="auth-bg-glow"></div>

      <div className="auth-container animate-fade-in">
        <div className="auth-brand">
          <span className="auth-logo">🦅</span>
          <h1 className="auth-title">LogHawk</h1>
          <p className="auth-subtitle">Security Log Analysis Platform</p>
        </div>

        <div className="auth-card glass-card">
          <h2 className="auth-card-title">New Password</h2>
          
          {!success ? (
            <>
              <p className="auth-card-desc">Choose a strong, complex password to secure your analyst account.</p>

              {error && (
                <div className="auth-error" id="reset-error">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="15" y1="9" x2="9" y2="15" />
                    <line x1="9" y1="9" x2="15" y2="15" />
                  </svg>
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="auth-form">
                <div className="form-group">
                  <label htmlFor="newPassword">New Password</label>
                  <input
                    type="password"
                    id="newPassword"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                    required
                    disabled={!token || !email}
                    autoComplete="new-password"
                  />
                </div>

                {/* Password Strength Checklist */}
                <div className="password-requirements-list">
                  <div className="password-requirements-title">Complexity Criteria:</div>
                  <div className={`password-requirement-item ${checks.length ? 'met' : ''}`}>
                    <span className="requirement-icon">{checks.length ? '✓' : '•'}</span>
                    <span>At least 8 characters long</span>
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

                <div className="form-group" style={{ marginTop: '1rem' }}>
                  <label htmlFor="confirmPassword">Confirm Password</label>
                  <input
                    type="password"
                    id="confirmPassword"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    required
                    disabled={!token || !email}
                    autoComplete="new-password"
                  />
                </div>

                <button
                  type="submit"
                  className="btn btn-primary auth-submit"
                  id="reset-submit"
                  disabled={loading || !token || !email}
                >
                  {loading ? 'Resetting Password...' : 'Reset Password'}
                </button>
              </form>
            </>
          ) : (
            <div style={{ textAlign: 'center' }}>
              <div className="auth-success" style={{
                background: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                color: 'var(--color-success)',
                padding: '0.75rem 1rem',
                borderRadius: 'var(--radius-sm)',
                marginBottom: '1.5rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                width: '100%',
                justifyContent: 'center'
              }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '1.25rem', height: '1.25rem' }}>
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span>{success}</span>
              </div>
              <p className="auth-card-desc">
                Redirecting you to the Sign In screen in a few seconds...
              </p>
              <div style={{ marginTop: '1.5rem' }}>
                <Link to="/login" className="btn btn-primary" style={{ fontSize: '0.875rem', padding: '0.5rem 1.5rem' }}>
                  Sign In Now
                </Link>
              </div>
            </div>
          )}

          <div className="auth-footer">
            <Link to="/login">Back to Sign In</Link>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ResetPassword
