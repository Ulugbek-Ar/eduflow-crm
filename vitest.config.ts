import { defineConfig } from 'vitest/config'

// Testlar uchun React Compiler plaginlari shart emas.
// localStorage yoki DOM kerak bo'lgan fayllar o'zida @vitest-environment jsdom deb belgilangan;
// komponent testlari (*.test.tsx) Testing Library bilan yoziladi
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
    restoreMocks: true,
    // PBKDF2 (210 000 iteratsiya) sekin CI mashinalarida bir necha soniya olishi mumkin
    testTimeout: 20_000,
  },
})
