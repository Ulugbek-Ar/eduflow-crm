import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { AuthContext } from '../hooks/useAuth'
import type { AuthContextValue } from '../hooks/useAuth'
import * as auth from '../services/auth.service'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState(auth.readSession)
  const [usingDefaultPassword, setUsingDefaultPassword] = useState(false)

  useEffect(() => {
    if (!auth.isCryptoAvailable()) return
    let cancelled = false
    auth.getCredentials().then((credentials) => {
      if (cancelled) return
      setUsingDefaultPassword(credentials.mustChange)
      // Login boshqa joyda o'zgartirilgan bo'lsa, eski sessiya bekor qilinadi
      setSession((current) => (current && current.login.toLowerCase() !== credentials.login.toLowerCase() ? null : current))
    })
    return () => {
      cancelled = true
    }
  }, [])

  const value: AuthContextValue = {
    session,
    usingDefaultPassword,
    login: async (login, password) => {
      if (!(await auth.verifyLogin(login, password))) return false
      const credentials = await auth.getCredentials()
      setUsingDefaultPassword(credentials.mustChange)
      setSession(auth.startSession(credentials.login))
      return true
    },
    logout: () => {
      auth.endSession()
      setSession(null)
    },
    changeCredentials: async (currentPassword, newLogin, newPassword) => {
      const result = await auth.changeCredentials(currentPassword, newLogin, newPassword)
      if (result.ok) {
        setUsingDefaultPassword(result.credentials.mustChange)
        setSession(auth.startSession(result.credentials.login))
      }
      return result
    },
  }

  return <AuthContext value={value}>{children}</AuthContext>
}
