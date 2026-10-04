#!/usr/bin/env node
/**
 * Prepara la base LOCAL para probar el inbox sin tocar producción.
 *
 * Qué hace, en orden:
 *   1. Aplica todas las migraciones de `migrations_v2/` a la D1 local de
 *      api-public (la que usa `wrangler dev`, en .wrangler/state).
 *   2. Siembra una organización y un usuario admin de prueba.
 *   3. Crea un token de integración con scope `inbox:write` y lo imprime.
 *
 * Es idempotente: se puede correr las veces que haga falta.
 *
 *   node scripts/local-inbox/seed-local.mjs
 *
 * Nunca apunta a producción: todos los comandos de wrangler llevan `--local`.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { tmpdir } from 'node:os'
import { SignJWT } from 'jose'

const __dirname = dirname(fileURLToPath(import.meta.url))
const BACKEND = join(__dirname, '..', '..')
const WORKER_DIR = join(BACKEND, 'packages', 'api-public')
const DB_NAME = 'vendepro-db'

// El mismo secreto de desarrollo que ya traen commiteado todos los workers
// (packages/*/.dev.vars). Tiene que coincidir o el worker rechaza el token.
const JWT_SECRET = process.env.JWT_SECRET ?? 'vendepro-local-dev-secret-do-not-use-in-prod'

const ORG_ID = 'org_local'
const USER_ID = 'user_local_admin'
const TOKEN_ID = 'tok_local_inbox'

function wrangler(args) {
  return execFileSync('npx', ['wrangler', ...args], {
    cwd: WORKER_DIR,
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: process.platform === 'win32',
  })
}

function sqlFile(sql) {
  const file = join(mkdtempSync(join(tmpdir(), 'vendepro-seed-')), 'seed.sql')
  writeFileSync(file, sql, 'utf-8')
  return file
}

console.log('1/3  Aplicando migraciones a la base local…')
const migrationsDir = join(BACKEND, 'migrations_v2')
const migraciones = readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort()
for (const archivo of migraciones) {
  try {
    wrangler(['d1', 'execute', DB_NAME, '--local', '--file', join(migrationsDir, archivo)])
  } catch (err) {
    // Correr el script dos veces re-aplica migraciones ya aplicadas. Los
    // CREATE TABLE IF NOT EXISTS pasan, pero un ALTER TABLE repetido falla y
    // las migraciones que siembran catálogos (operation_types, etapas…)
    // chocan contra su propia clave. En los tres casos el estado ya es el
    // correcto, así que se saltea.
    const salida = `${err.stdout ?? ''}${err.stderr ?? ''}`
    if (/duplicate column|already exists|UNIQUE constraint failed/i.test(salida)) continue
    console.error(`\n✗ Falló la migración ${archivo}:\n${salida}`)
    process.exit(1)
  }
}
console.log(`     ${migraciones.length} migraciones aplicadas.`)

console.log('2/3  Sembrando organización y usuario admin…')
wrangler(['d1', 'execute', DB_NAME, '--local', '--file', sqlFile(`
INSERT OR IGNORE INTO organizations (id, slug, name) VALUES ('${ORG_ID}', 'local', 'Inmobiliaria Local');
INSERT OR IGNORE INTO users (id, org_id, email, password_hash, full_name, role)
  VALUES ('${USER_ID}', '${ORG_ID}', 'admin@local.test', 'x', 'Admin Local', 'admin');
`)])

console.log('3/3  Creando token de integración con scope inbox:write…')
const token = await new SignJWT({ typ: 'integration', org_id: ORG_ID, tid: TOKEN_ID, scopes: ['inbox:write'] })
  .setProtectedHeader({ alg: 'HS256' })
  .setIssuedAt()
  .sign(new TextEncoder().encode(JWT_SECRET))

wrangler(['d1', 'execute', DB_NAME, '--local', '--file', sqlFile(`
INSERT OR REPLACE INTO api_tokens (id, org_id, name, scopes, prefix, is_active)
  VALUES ('${TOKEN_ID}', '${ORG_ID}', 'Inbox local', 'inbox:write', 'local…', 1);
`)])

console.log(`
Listo. La base local tiene la org "${ORG_ID}" y un token para el inbox.

  1. Levantá el worker (el .dev.vars ya viene en el repo):

       cd packages/api-public && npm run dev

  2. Simulá un mensaje entrante (no hace falta WhatsApp todavía):

       node scripts/local-inbox/fake-message.mjs "Hola, vi el depto de Cabildo"

TOKEN:
${token}
`)
