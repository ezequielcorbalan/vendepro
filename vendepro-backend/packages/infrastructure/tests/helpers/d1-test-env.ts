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
 * Parte una migración en sentencias ejecutables, salteando comentarios `--`.
 *
 * Es consciente de los strings: un `;` o un `--` dentro de un literal SQL son
 * datos, no sintaxis. Sin eso, una migración con un punto y coma en una
 * descripción se parte al medio y falla con "unrecognized token", aunque
 * SQLite y `wrangler d1 migrations apply` la acepten sin problema.
 *
 * SQLite escapa la comilla simple duplicándola (`''`), y eso se respeta acá.
 */
function splitStatements(sql: string): string[] {
  const statements: string[] = []
  let current = ''
  let inString = false

  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i]

    if (inString) {
      current += ch
      if (ch === "'") {
        // `''` es una comilla escapada, no el cierre del literal.
        if (sql[i + 1] === "'") { current += "'"; i++ }
        else inString = false
      }
      continue
    }

    if (ch === "'") { inString = true; current += ch; continue }

    // Comentario de línea fuera de string: se descarta hasta el salto.
    if (ch === '-' && sql[i + 1] === '-') {
      const nl = sql.indexOf('\n', i)
      if (nl === -1) break
      i = nl - 1
      continue
    }

    if (ch === ';') {
      const trimmed = current.trim()
      if (trimmed.length > 0) statements.push(trimmed)
      current = ''
      continue
    }

    current += ch
  }

  const last = current.trim()
  if (last.length > 0) statements.push(last)
  return statements
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
