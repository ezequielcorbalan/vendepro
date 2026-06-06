import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.smoke.test.ts'],
    globals: true,
    // Smoke hits production sequentially to avoid race conditions on stage_history.
    fileParallelism: false,
    sequence: { concurrent: false },
    testTimeout: 30_000,
    hookTimeout: 60_000,
    // Each test gets one retry: production network flakes shouldn't fail the deploy.
    retry: 1,
    reporters: process.env.CI
      ? ['default', ['junit', { outputFile: './smoke-results.xml' }]]
      : ['default'],
  },
})
