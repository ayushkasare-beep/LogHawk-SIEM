/**
 * LogHawk – Register Page
 *
 * New user registration page. Captures username, email, and password.
 * Enforces strong password constraints with a real-time validation indicator.
 */

import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import useDocumentTitle from '../hooks/useDocumentTitle'
import './Auth.css'
import './ResetPassword.css' // Reuse the password requirements list styling

function Register() {
  useDocumentTitle('Register')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [isRegistered, setIsRegistered] = useState(false)
  const [countdown, setCountdown] = useState(5)

  const { register } = useAuth()
  const navigate = useNavigate()

  // Real-time password check state
  const [checks, setChecks] = useState({
    length: false,
    uppercase: false,
    lowercase: false,
    number: false,
    special: false
  })

  useEffect(() => {
    setChecks({
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number: /[0-9]/.test(password),
      special: /[!@#$%^&*(),.?":{}|<>]/.test(password)
    })
  }, [password])

  // Countdown timer redirect after successful registration
  useEffect(() => {
    if (!isRegistered) return
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          navigate('/login')
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [isRegistered, navigate])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    // Client-side validations
    if (!username.trim()) {
      setError('Username is required.')
      return
    }
    if (!email.trim()) {
      setError('Email address is required.')
      return
    }

    const emailRegex = /^\S+@\S+\.\S+$/
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address.')
      return
    }

    const allPassed = Object.values(checks).every(val => val === true)
    if (!allPassed) {
      setError('Password does not fulfill security requirements.')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)

    try {
      const data = await register(username, email, password)
      setSuccessMessage(data.message || 'Account created successfully. Please log in to continue.')
      setIsRegistered(true)
    } catch (err) {
      console.error(err)
      setError(err.response?.data?.message || 'Registration failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page" id="register-page">
      <div className="auth-bg-grid"></div>
      <div className="auth-bg-glow"></div>

      <div className="auth-container animate-fade-in">
        <div className="auth-brand">
          <span className="auth-logo">🦅</span>
          <h1 className="auth-title">LogHawk</h1>
          <p className="auth-subtitle">Security Log Analysis Platform</p>
        </div>

        {isRegistered ? (
          <div className="auth-card glass-card success-card animate-fade-in" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', color: 'var(--color-accent)', marginBottom: '1rem' }}>✓</div>
            <h2 className="auth-card-title" style={{ color: 'var(--color-text-primary)' }}>Registration Successful!</h2>
            <p className="auth-card-desc" style={{ color: 'var(--color-accent)', fontWeight: 600, fontSize: '0.95rem', marginTop: '0.5rem' }}>
              {successMessage}
            </p>
            <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', margin: '1.5rem 0' }}>
              Redirecting you to the Login page in <span style={{ color: 'var(--color-accent)', fontWeight: 'bold' }}>{countdown}</span> seconds...
            </p>
            <button
              onClick={() => navigate('/login')}
              className="btn btn-primary"
              style={{ width: '100%' }}
            >
              Go to Login
            </button>
          </div>
        ) : (
          <div className="auth-card glass-card">
            <h2 className="auth-card-title">Create Account</h2>
            <p className="auth-card-desc">Set up your analyst profile</p>

            {error && (
              <div className="auth-error" id="register-error">
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
                <label htmlFor="username">Username</label>
                <input
                  type="text"
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="analyst_jane"
                  required
                  autoComplete="username"
                />
              </div>

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

              <div className="form-group">
                <label htmlFor="password">Password</label>
                <div className="password-input-container">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Create secure password"
                    required
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className="password-toggle-btn"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Real-time Validation Checks list */}
              <div className="password-requirements-list">
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

              <div className="form-group" style={{ marginTop: '1rem' }}>
                <label htmlFor="confirm-password">Confirm Password</label>
                <div className="password-input-container">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    id="confirm-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
                    required
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className="password-toggle-btn"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                  >
                    {showConfirmPassword ? (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="btn btn-primary auth-submit"
                id="register-submit"
                disabled={loading}
              >
                {loading ? 'Creating Account...' : 'Create Account'}
              </button>
            </form>

            <div className="auth-footer">
              <p>
                Already have an account?{' '}
                <Link to="/login">Sign In</Link>
              </p>
            </div>
          </div>
        )}

        <div className="auth-notice">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          <span>Passwords hashed with bcrypt • Data encrypted in transit</span>
        </div>
      </div>
    </div>
  )
}

export default Register
