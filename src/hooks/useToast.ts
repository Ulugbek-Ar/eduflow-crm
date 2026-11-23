import { createContext, useContext } from 'react'

export type ToastTone = 'success' | 'error' | 'info'

// Toast ichidagi tugma (masalan, o'chirishdan keyin "Bekor qilish")
export interface ToastAction {
  label: string
  onClick: () => void
}

export interface ToastOptions {
  action?: ToastAction
}

export interface ToastApi {
  success: (message: string, options?: ToastOptions) => void
  error: (message: string, options?: ToastOptions) => void
  info: (message: string, options?: ToastOptions) => void
}

export const ToastContext = createContext<ToastApi | null>(null)

export function useToast(): ToastApi {
  const toast = useContext(ToastContext)
  if (!toast) throw new Error('useToast ToastProvider ichida ishlatilishi kerak')
  return toast
}
