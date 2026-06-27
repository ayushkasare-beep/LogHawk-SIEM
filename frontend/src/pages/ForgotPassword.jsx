/**
 * LogHawk – Forgot Password Page
 *
 * Initiates the password recovery flow. Displays email input, verifies accounts,
 * and outputs the simulated reset URL directly on-screen for development testing.
 */

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import useDocumentTitle from '../hooks/useDocumentTitle'
import './Auth.css'
import './ForgotPassword.css'

function ForgotPassword() {
  useDocumentTitle('Forgot Password')
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [resetUrl, setResetUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const { forgotPassword } = useAuth()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setResetUrl('')
    setLoading(true)

    try {
      const res = await forgotPassword(email)
      setSuccess('Reset link generated successfully!')
      if (res.data?.resetUrl) {
        setResetUrl(res.data.resetUrl)
      }
    } catch (err) {
      console.error(err)
      setError(err.response?.data?.message || 'Failed to verify account. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page" id="forgot-password-page">
      <div className="auth-bg-grid"></div>
      <div className="auth-bg-glow"></div>

      <div className="auth-container animate-fade-in">
        <div className="auth-brand">
          <span className="auth-logo">🦅</span>
          <h1 className="auth-title">LogHawk</h1>
          <p className="auth-subtitle">Security Log Analysis Platform</p>
        </div>

        <div className="auth-card glass-card">
          <h2 className="auth-card-title">Reset Password</h2>
          
          {!success ? (
            <>
              <p className="auth-card-desc">Enter your email address to generate a secure recovery token.</p>

              {error && (
                <div className="auth-error" id="forgot-error">
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
                  <label htmlFor="email">Email Address</label>
                  <input
                    type="email"
                    id="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="analyst@loghawk.io"
                    required
                    autoComplete="email"
                  />
                </div>

                <button
                  type="submit"
                  className="btn btn-primary auth-submit"
                  id="forgot-submit"
                  disabled={loading}
                >
                  {loading ? 'Verifying Account...' : 'Generate Reset Link'}
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
                marginBottom: '1rem',
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
              
              <p className="auth-card-desc" style={{ fontSize: '0.9rem' }}>
                For local development/review, copy and open the password reset URL below:
              </p>

              {resetUrl && (
                <div className="forgot-password-link-box">
                  <div className="forgot-password-link-title">Reset Link:</div>
                  <a href={resetUrl} className="forgot-password-link-text">
                    {resetUrl}
                  </a>
                </div>
              )}

              <div className="forgot-password-success-actions">
                <Link to="/login" className="btn btn-outline" style={{ fontSize: '0.875rem' }}>
                  Return to Sign In
                </Link>
              </div>
            </div>
          )}

          {!success && (
            <div className="auth-footer">
              <Link to="/login">Back to Login</Link>
            </div>
          )}
        </div>

        <div className="auth-notice">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          <span>Secure Token Generation & Password Complexity Checks</span>
        </div>
      </div>
    </div>
  )
}

export default ForgotPassword
