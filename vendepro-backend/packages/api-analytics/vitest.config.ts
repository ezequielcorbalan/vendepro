import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    passWithNoTests: true,
    // El primer test de cada archivo arranca miniflare en frío (~5s), lo que
    // hacía saltar el default de 5000ms de forma intermitente (sobre todo bajo
    // turbo). Damos margen para evitar timeouts flaky.
    testTimeout: 20_000,
    hookTimeout: 30_000,
  },
})
