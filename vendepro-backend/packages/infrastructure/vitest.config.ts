import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    passWithNoTests: true,
    // Cada test arma su propio Miniflare + corre 31 migraciones. Con el default
    // (10s) y todos los workers en paralelo, las máquinas se saturan y los
    // beforeEach/beforeAll caen en "Hook timed out". Subimos el techo y
    // limitamos el paralelismo para que cada Miniflare tenga aire.
    hookTimeout: 30_000,
    testTimeout: 30_000,
    poolOptions: {
      threads: { maxThreads: 4, minThreads: 1 },
    },
  },
})
