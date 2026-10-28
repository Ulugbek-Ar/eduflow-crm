import { createContext, useContext } from 'react'
import type { ChangeResult, Session } from '../services/auth.service'

export interface AuthContextValue {
  session: Session | null
  // Standart parol hali ishlatilmoqda
  usingDefaultPassword: boolean
  login: (login: string, password: string) => Promise<boolean>
  logout: () => void
  changeCredentials: (currentPassword: string, newLogin: string, newPassword: string) => Promise<ChangeResult>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth AuthProvider ichida ishlatilishi kerak')
  return context
}
