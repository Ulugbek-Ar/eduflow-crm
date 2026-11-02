import type { SaveFailure, SaveResult } from '../services/storage.service'

export interface SaveMonitor {
  // Yangi turdagi xato bo'lsa sababini qaytaradi (toast ko'rsatish kerak), aks holda null
  report: (key: string, result: SaveResult) => SaveFailure | null
  // Hozir saqlanmay turgan kalit bormi
  isFailing: () => boolean
}

// Bir xil xato uchun toast takror-takror chiqmasligi uchun: xato kalit muvaffaqiyatli saqlanmaguncha
// shu sabab "faol" hisoblanadi. Barcha kalitlar saqlangach, keyingi xato yana xabar qilinadi.
export function createSaveMonitor(): SaveMonitor {
  const failing = new Map<string, SaveFailure>()
  return {
    report: (key, result) => {
      if (result.ok) {
        failing.delete(key)
        return null
      }
      const alreadyShown = Array.from(failing.values()).includes(result.reason)
      failing.set(key, result.reason)
      return alreadyShown ? null : result.reason
    },
    isFailing: () => failing.size > 0,
  }
}
