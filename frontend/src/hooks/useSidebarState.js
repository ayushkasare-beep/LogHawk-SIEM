// Custom hook for sidebar collapsed state.
// Persists to localStorage so the user's preference survives refreshes.

import { useState, useEffect } from 'react'

export function useSidebarState() {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem('loghawk_sidebar_collapsed') === 'true'
    } catch {
      return false
    }
  })

  useEffect(() => {
    localStorage.setItem('loghawk_sidebar_collapsed', collapsed)
  }, [collapsed])

  const toggle = () => setCollapsed(prev => !prev)

  return { collapsed, toggle }
}
