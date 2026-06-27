/**
 * ====================================
 * LogHawk – Authentication Context
 * ====================================
 * Provides global authentication state across the application.
 * Manages user login, registration, logout, and token persistence.
 * 
 * Usage:
 *   const { user, login, register, logout, loading, updateUserProfile, forgotPassword, resetPassword } = useAuth()
 */

import { createContext, useContext, useState, useEffect } from 'react'
import api, { setUnauthorizedHandler } from '../services/api'

const AuthContext = createContext(null)

/**
 * AuthProvider – Wraps the application and provides auth state.
 * On mount, checks localStorage for an existing JWT token and
 * attempts to restore the user session.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  // Restore session from stored token on app initialization
  useEffect(() => {
    setUnauthorizedHandler(() => {
      localStorage.removeItem('loghawk_token')
      delete api.defaults.headers.common['Authorization']
      setUser(null)
    })

    const token = localStorage.getItem('loghawk_token')
    if (token) {
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`
      // Verify token validity with the backend
      api.get('/api/auth/me')
        .then(res => setUser(res.data.user))
        .catch(() => {
          localStorage.removeItem('loghawk_token')
          delete api.defaults.headers.common['Authorization']
          setUser(null)
        })
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [])

  /**
   * login – Authenticates user with email and password.
   * Stores JWT token and sets user state.
   */
  const login = async (email, password) => {
    const res = await api.post('/api/auth/login', { email, password })
    const { token, user: userData } = res.data
    localStorage.setItem('loghawk_token', token)
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`
    setUser(userData)
    return userData
  }

  /**
   * register – Creates a new user account.
   * Does NOT automatically log in after successful registration.
   */
  const register = async (username, email, password) => {
    const res = await api.post('/api/auth/register', { username, email, password })
    return res.data
  }

  /**
   * logout – Clears user session and removes stored token.
   */
  const logout = async () => {
    try {
      await api.post('/api/auth/logout')
    } catch {
      // Ignore network/server errors during logout
    } finally {
      localStorage.removeItem('loghawk_token')
      delete api.defaults.headers.common['Authorization']
      setUser(null)
    }
  }

  /**
   * updateUserProfile – Updates user profile name and email.
   * Updates local state with returned details.
   */
  const updateUserProfile = async (username, email) => {
    const res = await api.put('/api/auth/profile', { username, email })
    const { user: userData } = res.data
    setUser(userData)
    return userData
  }

  /**
   * forgotPassword – Submits reset password email request.
   */
  const forgotPassword = async (email) => {
    return await api.post('/api/auth/forgot-password', { email })
  }

  /**
   * resetPassword – Submits new password using token.
   */
  const resetPassword = async (email, token, newPassword, confirmPassword) => {
    return await api.post('/api/auth/reset-password', {
      email,
      token,
      newPassword,
      confirmPassword
    })
  }

  const value = {
    user,
    loading,
    login,
    register,
    logout,
    updateUserProfile,
    forgotPassword,
    resetPassword,
    isAuthenticated: !!user,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

/**
 * useAuth – Custom hook to access authentication context.
 * Must be used within an AuthProvider.
 */
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export default AuthContext
