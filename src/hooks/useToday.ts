import { useState } from 'react'
import { dayString } from '../utils/groups'

// Bugungi sana 'YYYY-MM-DD' (komponent ochilgan paytdagi): render ichida new Date() chaqirilmaydi
export function useToday(): string {
  const [today] = useState(() => dayString(new Date()))
  return today
}

// Hozirgi vaqt (daqiqada, 00:00 dan) — bir daqiqada bir yangilanadi emas, komponent ochilgandagi qiymat
export function useNowMinutes(): number {
  const [minutes] = useState(() => {
    const now = new Date()
    return now.getHours() * 60 + now.getMinutes()
  })
  return minutes
}
