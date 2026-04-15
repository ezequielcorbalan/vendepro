'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { getCurrentUser, setCurrentUser, logout as logoutHelper, type CurrentUser } from '@/lib/auth'
import { setToken, clearToken } from '@/lib/api'

interface AuthContextType {
  user: CurrentUser | null
  login: (user: CurrentUser, token: string) => void
  logout: () => void
  loading: boolean
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  login: () => {},
  logout: () => {},
  loading: true,
})

export function useAuth() {
  return useContext(AuthContext)
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const u = getCurrentUser()
    setUser(u)
    setLoading(false)
  }, [])

  function login(userData: CurrentUser, token: string) {
    setToken(token)
    // Also set cookie for middleware
    document.cookie = `vendepro_token=${token}; path=/; SameSite=Lax; Max-Age=${60 * 60 * 24 * 30}`
    setCurrentUser(userData)
    setUser(userData)
  }

  function logout() {
    logoutHelper()
    clearToken()
    document.cookie = 'vendepro_token=; Max-Age=0; path=/'
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  )
}
