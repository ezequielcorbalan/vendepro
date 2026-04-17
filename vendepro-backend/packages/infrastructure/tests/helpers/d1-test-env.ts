import { Miniflare } from 'miniflare'
import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

export interface TestEnv {
  DB: D1Database
  mf: Miniflare
}

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

let cachedMigrations: string[] | null = null

/**
 * Loads every `.sql` file in `vendepro-backend/migrations_v2/`, sorted alphabetically
 * (which matches wrangler's execution order). Each file contributes zero or more
 * statements; they are concatenated and returned.
 *
 * Resolution is anchored to __dirname so it works regardless of where vitest is
 * launched from (monorepo root, package root, etc.).
 */
function loadMigrations(): string[] {
  if (cachedMigrations !== null) return cachedMigrations
  // __dirname → packages/infrastructure/tests/helpers
  // → ../../../../ → vendepro-backend/
  const dir = join(__dirname, '..', '..', '..', '..', 'migrations_v2')
  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort()
  cachedMigrations = files.map((f) => readFileSync(join(dir, f), 'utf-8'))
  return cachedMigrations
}

/**
 * Strips line-level SQL comments and blank lines, then splits on `;` into executable
 * statements. Works for the current migrations because none contain CREATE TRIGGER
 * blocks with inline semicolons. Revisit if triggers are added.
 */
function splitStatements(sql: string): string[] {
  const withoutLineComments = sql
    .split('\n')
    .map((line) => {
      const idx = line.indexOf('--')
      return idx >= 0 ? line.slice(0, idx) : line
    })
    .join('\n')

  return withoutLineComments
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

export async function createTestDB(): Promise<TestEnv> {
  const mf = new Miniflare({
    modules: true,
    script: 'export default { async fetch() { return new Response(null) } }',
    d1Databases: { DB: 'test-db-' + crypto.randomUUID() },
  })
  const DB = (await mf.getD1Database('DB')) as unknown as D1Database
  for (const migration of loadMigrations()) {
    for (const stmt of splitStatements(migration)) {
      await DB.prepare(stmt).run()
    }
  }
  return { DB, mf }
}

export async function closeTestDB(env: TestEnv): Promise<void> {
  await env.mf.dispose()
}
