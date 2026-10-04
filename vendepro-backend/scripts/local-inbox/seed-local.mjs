#!/usr/bin/env node
/**
 * Prepara el stack LOCAL para probar el inbox. No toca producción: todos los
 * comandos de wrangler llevan `--local` y apuntan al mismo estado compartido
 * que usa `./dev.sh` (`.wrangler-local-state` en la raíz del repo). Si cada
 * worker usara el suyo, lo que siembra este script no lo vería el CRM.
 *
 *   node scripts/local-inbox/seed-local.mjs            → org, usuario y token
 *   node scripts/local-inbox/seed-local.mjs --demo     → + conversaciones de ejemplo
 *
 * Es idempotente: se puede correr las veces que haga falta.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync, existsSync, mkdtempSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { tmpdir } from 'node:os'
import { createHash, randomUUID } from 'node:crypto'
import { SignJWT } from 'jose'

const __dirname = dirname(fileURLToPath(import.meta.url))
const BACKEND = join(__dirname, '..', '..')
const REPO = join(BACKEND, '..')
const WORKER_DIR = join(BACKEND, 'packages', 'api-public')
const SHARED_STATE = join(REPO, '.wrangler-local-state')
const DB_NAME = 'vendepro-db'

const ORG_ID = 'org_local'
const USER_ID = 'user_local_admin'
const TOKEN_ID = 'tok_local_inbox'
const LOGIN = { email: 'admin@local.test', password: 'local1234' }

/** El secreto que usan los workers locales; sale de su propio .dev.vars. */
function leerJwtSecret() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET
  const archivo = join(WORKER_DIR, '.dev.vars')
  if (existsSync(archivo)) {
    const linea = readFileSync(archivo, 'utf-8').split('\n').find(l => l.trim().startsWith('JWT_SECRET'))
    if (linea) return linea.split('=').slice(1).join('=').trim().replace(/^["']|["']$/g, '')
  }
  throw new Error('No encontré JWT_SECRET. Corré ./dev.sh setup o exportá JWT_SECRET.')
}

const JWT_SECRET = leerJwtSecret()

function wrangler(args) {
  return execFileSync('npx', ['wrangler', ...args, '--persist-to', SHARED_STATE], {
    cwd: WORKER_DIR,
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: process.platform === 'win32',
  })
}

function ejecutarSql(sql) {
  const file = join(mkdtempSync(join(tmpdir(), 'vendepro-seed-')), 'seed.sql')
  writeFileSync(file, sql, 'utf-8')
  return wrangler(['d1', 'execute', DB_NAME, '--local', '--file', file])
}

/** Mismo hash que JwtAuthService: SHA-256 de password + salt. */
function hashPassword(password) {
  return createHash('sha256').update(`${password}reportes-mg-salt-2026`).digest('hex')
}

const id = (prefijo) => `${prefijo}_${randomUUID().replace(/-/g, '').slice(0, 16)}`

console.log('1/4  Aplicando migraciones al estado compartido…')
const migrationsDir = join(BACKEND, 'migrations_v2')
const migraciones = readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort()
for (const archivo of migraciones) {
  try {
    wrangler(['d1', 'execute', DB_NAME, '--local', '--file', join(migrationsDir, archivo)])
  } catch (err) {
    // Re-correr el script re-aplica migraciones ya aplicadas: los CREATE TABLE
    // IF NOT EXISTS pasan, pero un ALTER TABLE repetido falla y las que
    // siembran catálogos chocan contra su propia clave. El estado ya es el
    // correcto en los tres casos.
    const salida = `${err.stdout ?? ''}${err.stderr ?? ''}`
    if (/duplicate column|already exists|UNIQUE constraint failed/i.test(salida)) continue
    console.error(`\n✗ Falló la migración ${archivo}:\n${salida}`)
    process.exit(1)
  }
}
console.log(`     ${migraciones.length} migraciones aplicadas.`)

console.log('2/4  Sembrando organización y usuario…')
ejecutarSql(`
INSERT OR IGNORE INTO organizations (id, slug, name) VALUES ('${ORG_ID}', 'local', 'Inmobiliaria Local');
INSERT OR REPLACE INTO users (id, org_id, email, password_hash, full_name, role, active)
  VALUES ('${USER_ID}', '${ORG_ID}', '${LOGIN.email}', '${hashPassword(LOGIN.password)}', 'Admin Local', 'admin', 1);
`)

console.log('3/4  Creando token de integración (scope inbox:write)…')
const token = await new SignJWT({ typ: 'integration', org_id: ORG_ID, tid: TOKEN_ID, scopes: ['inbox:write'] })
  .setProtectedHeader({ alg: 'HS256' })
  .setIssuedAt()
  .sign(new TextEncoder().encode(JWT_SECRET))

ejecutarSql(`
INSERT OR REPLACE INTO api_tokens (id, org_id, name, scopes, prefix, is_active)
  VALUES ('${TOKEN_ID}', '${ORG_ID}', 'Inbox local', 'inbox:write', 'local…', 1);
`)

if (process.argv.includes('--demo')) {
  console.log('4/4  Conversaciones de ejemplo…')
  const ahora = new Date()
  const haceRato = (minutos) => new Date(ahora.getTime() - minutos * 60000).toISOString()
  const ventana = new Date(ahora.getTime() + 20 * 3600_000).toISOString()

  const demos = [
    {
      nombre: 'Juan Pérez', tel: '1155551234', estado: 'open', asignado: USER_ID, labels: '[]',
      mensajes: [
        ['in', 'contact', 'Hola, vi el depto de Cabildo 2040. ¿Sigue disponible?', 45],
        ['out', 'bot', 'Hola Juan, sí sigue disponible. ¿Querés coordinar una visita?', 44],
        ['in', 'contact', 'Sí, el jueves a la tarde me queda bien', 40],
      ],
    },
    {
      nombre: 'Lucía Fernández', tel: '1144449999', estado: 'open', asignado: null, labels: '["bot_pausado"]',
      mensajes: [
        ['in', 'contact', 'Buenas, quiero tasar mi casa en Villa Urquiza', 120],
        ['out', 'agent', 'Hola Lucía, te paso con una asesora.', 118],
      ],
    },
    {
      nombre: 'Marcos Gutiérrez', tel: '1133332222', estado: 'resolved', asignado: USER_ID, labels: '[]',
      mensajes: [['in', 'contact', '¡Gracias por todo!', 2880]],
    },
  ]

  let sql = ''
  for (const d of demos) {
    const contactId = id('contact')
    const convId = id('conv')
    const ultimo = d.mensajes[d.mensajes.length - 1][3]
    sql += `
INSERT OR IGNORE INTO contacts (id, org_id, full_name, phone, contact_type, source, agent_id)
  VALUES ('${contactId}', '${ORG_ID}', '${d.nombre}', '${d.tel}', 'comprador', 'whatsapp', '${USER_ID}');
INSERT OR IGNORE INTO conversations (id, org_id, channel, contact_id, external_id, status, assignee_id, labels, last_activity_at, window_expires_at)
  VALUES ('${convId}', '${ORG_ID}', 'whatsapp', '${contactId}', '549${d.tel}@c.us', '${d.estado}',
          ${d.asignado ? `'${d.asignado}'` : 'NULL'}, '${d.labels}', '${haceRato(ultimo)}',
          ${d.estado === 'resolved' ? 'NULL' : `'${ventana}'`});`
    for (const [dir, quien, texto, hace] of d.mensajes) {
      sql += `
INSERT OR IGNORE INTO messages (id, org_id, conversation_id, direction, sender_type, sender_id, content, external_id, created_at)
  VALUES ('${id('msg')}', '${ORG_ID}', '${convId}', '${dir}', '${quien}',
          ${quien === 'agent' ? `'${USER_ID}'` : 'NULL'}, '${texto.replace(/'/g, "''")}', '${id('ext')}', '${haceRato(hace)}');`
    }
  }
  // WhatsApp apuntando al WAHA del compose, para poder probar el envío.
  sql += `
INSERT OR REPLACE INTO org_integrations (id, org_id, provider, config_json, enabled)
  VALUES ('int_local_wa', '${ORG_ID}', 'whatsapp', '{"provider":"waha","base_url":"http://localhost:3001","session":"default"}', 1);`
  ejecutarSql(sql)
  console.log(`     ${demos.length} conversaciones cargadas.`)
} else {
  console.log('4/4  (sin --demo: no se cargan conversaciones de ejemplo)')
}

console.log(`
Listo.

  Levantá el stack:   ./dev.sh
  Entrá a:            http://localhost:3000/conversaciones
  Usuario:            ${LOGIN.email}
  Contraseña:         ${LOGIN.password}

  Simular un mensaje entrante (con el stack arriba):
    node scripts/local-inbox/fake-message.mjs "Hola, consulto por una propiedad"

TOKEN (scope inbox:write):
${token}
`)
