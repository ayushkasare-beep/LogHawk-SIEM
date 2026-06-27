/**
 * ====================================
 * LogHawk – API Service
 * ====================================
 * Centralized Axios instance for all API communication.
 * Configured with base URL and interceptors for authentication
 * and error handling.
 * 
 * All API calls throughout the app should use this instance
 * instead of importing axios directly.
 */

import axios from 'axios'

// Create axios instance with default configuration
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000',
  timeout: 30000, // 30 second timeout for log processing requests
  headers: {
    'Content-Type': 'application/json',
  },
})

/**
 * Request Interceptor
 * Attaches JWT token to every outgoing request if available.
 */
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('loghawk_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

let unauthorizedHandler = null

export const setUnauthorizedHandler = (handler) => {
  unauthorizedHandler = handler
}

/**
 * Response Interceptor
 * Handles 401 Unauthorized responses by clearing the session
 * and redirecting to the login page.
 */
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('loghawk_token')
      if (unauthorizedHandler) {
        unauthorizedHandler()
      } else if (window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

export default api
