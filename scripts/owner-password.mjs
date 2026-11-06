// Sotuvchi paneli (/owner) paroli uchun xesh: node scripts/owner-password.mjs "parolingiz"
// Natijani Vercel → Settings → Environment Variables ga VITE_OWNER_PASSWORD_HASH sifatida qo'ying
import { webcrypto as crypto } from 'node:crypto'

const password = process.argv[2]
if (!password || password.length < 12) {
  console.error('Parolni bering (kamida 12 belgi): node scripts/owner-password.mjs "uzun-parol"')
  process.exit(1)
}
const salt = Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString('hex')
const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: new TextEncoder().encode(salt), iterations: 210_000 }, key, 256)
console.log(`${salt}:${Buffer.from(bits).toString('hex')}`)
