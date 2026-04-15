import { defineWorkspace } from 'vitest/config'

export default defineWorkspace([
  // Core unit tests (no Cloudflare env needed)
  'packages/core/vitest.config.ts',
  // Infrastructure integration tests (need Cloudflare D1 via miniflare)
  'packages/infrastructure/vitest.config.ts',
  // API route tests (need Cloudflare env)
  'packages/api-auth/vitest.config.ts',
  'packages/api-crm/vitest.config.ts',
  'packages/api-properties/vitest.config.ts',
  'packages/api-transactions/vitest.config.ts',
  'packages/api-analytics/vitest.config.ts',
  'packages/api-ai/vitest.config.ts',
  'packages/api-admin/vitest.config.ts',
  'packages/api-public/vitest.config.ts',
])
