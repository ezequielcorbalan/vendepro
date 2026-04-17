import { Miniflare } from 'miniflare'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

export interface TestEnv {
  DB: D1Database
  mf: Miniflare
}

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

let schemaSql: string | null = null

/**
 * Loads the canonical hexagonal schema from `vendepro-backend/migrations_v2/000_initial.sql`.
 *
 * Resolution is anchored to this file's directory (packages/infrastructure/tests/helpers)
 * so it works regardless of where vitest is launched from (monorepo root, package root, etc.).
 *
 * NOTE: We intentionally load the v2 hexagonal initial migration rather than the legacy
 * root-level `schema.sql`, because adapter integration tests built on top of this helper
 * target the hexagonal data model (leads, contacts, stage_history, users with org_id, ...).
 */
function loadSchema(): string {
  if (schemaSql !== null) return schemaSql
  // __dirname → packages/infrastructure/tests/helpers
  // → ../../../../ → vendepro-backend/
  const path = join(__dirname, '..', '..', '..', '..', 'migrations_v2', '000_initial.sql')
  const loaded = readFileSync(path, 'utf-8')
  schemaSql = loaded
  return loaded
}

/**
 * Strips line-level SQL comments and blank lines, then splits on `;` into executable
 * statements. Works for the current schema because it contains no CREATE TRIGGER blocks
 * with inline semicolons. Revisit if triggers are added.
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
  const statements = splitStatements(loadSchema())
  for (const stmt of statements) {
    await DB.prepare(stmt).run()
  }
  return { DB, mf }
}

export async function closeTestDB(env: TestEnv): Promise<void> {
  await env.mf.dispose()
}
