// Super Admin session context -- deliberately parallel to, never sharing state with,
// src/auth/AuthContext.jsx. Separate localStorage keys (platformToken/platformUser) and a
// separate axios instance (src/api/platformAxios.js) so a tenant session and a platform
// session can coexist in the same browser without ever being confused for one another.
import { createContext, useContext, useState, useCallback } from 'react'
import { login as apiLogin } from '../api/platformAuth'
import { queryClient } from '../queryClient'

const PlatformAuthContext = createContext(null)

export function PlatformAuthProvider({ children }) {
  const [admin, setAdmin] = useState(() => {
    try {
      const stored = localStorage.getItem('platformUser')
      return stored ? JSON.parse(stored) : null
    } catch {
      return null
    }
  })

  const login = useCallback(async (email, password) => {
    const data = await apiLogin(email, password)
    const adminInfo = { email: data.email }
    queryClient.clear()
    localStorage.setItem('platformToken', data.token)
    localStorage.setItem('platformUser', JSON.stringify(adminInfo))
    setAdmin(adminInfo)
    return adminInfo
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('platformToken')
    localStorage.removeItem('platformUser')
    setAdmin(null)
    queryClient.clear()
  }, [])

  return (
    <PlatformAuthContext.Provider value={{ admin, login, logout, isAuthenticated: !!admin }}>
      {children}
    </PlatformAuthContext.Provider>
  )
}

export function usePlatformAuth() {
  const ctx = useContext(PlatformAuthContext)
  if (!ctx) throw new Error('usePlatformAuth must be used within PlatformAuthProvider')
  return ctx
}
