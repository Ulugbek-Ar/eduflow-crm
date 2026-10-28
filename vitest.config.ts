import { defineConfig } from 'vitest/config'

// Testlar sof funksiyalar va servislar uchun: React Compiler plaginlari shart emas.
// localStorage kerak bo'lgan fayllar o'zida @vitest-environment jsdom deb belgilangan
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    restoreMocks: true,
  },
})
