import { useAuth } from './useAuth'

// Bulutli rejimda markaz id'si (onlayn to'lov, integratsiyalar); lokal va demo rejimda — null
export function useCloudOrgId(): string | null {
  return useAuth().cloud?.org?.id ?? null
}
