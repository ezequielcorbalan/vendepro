#!/usr/bin/env node
/**
 * Utilitario del feed XML de portales (ZonaProp / Argenprop).
 *
 *   node scripts/portal-feed.mjs create <org_id> <portal> ["Anunciante"] [email] [tel]
 *       Imprime el INSERT con un token aleatorio y la URL a cargar en el
 *       Panel del Anunciante. NO toca la base: la SQL la corrés vos con
 *       `npx wrangler d1 execute` (no deployamos desde la terminal).
 *
 *   node scripts/portal-feed.mjs check <url>
 *       Descarga el feed, valida que el XML parsee y resume qué salió.
 *       Es lo que conviene correr antes de darle la URL a ZonaProp.
 */

import { randomBytes } from 'node:crypto'

const API_BASE = process.env.PORTAL_FEED_API ?? 'https://public.api.vendepro.com.ar'

function die(msg) {
  console.error(`\n  ${msg}\n`)
  process.exit(1)
}

function sqlEscape(value) {
  if (value === null || value === undefined) return 'NULL'
  return `'${String(value).replace(/'/g, "''")}'`
}

function create([orgId, portal, name, email, phone]) {
  if (!orgId || !portal) die('Uso: portal-feed.mjs create <org_id> <portal> ["Anunciante"] [email] [tel]')

  const id = `pf_${randomBytes(8).toString('hex')}`
  // 32 bytes: la URL es pública y sin auth, tiene que ser infactible de adivinar.
  const token = randomBytes(32).toString('base64url')

  console.log(`
-- Feed ${portal} para ${orgId}
INSERT INTO portal_feeds (id, org_id, portal, token, enabled, advertiser_name, advertiser_email, advertiser_phone)
VALUES (${sqlEscape(id)}, ${sqlEscape(orgId)}, ${sqlEscape(portal)}, ${sqlEscape(token)}, 1, ${sqlEscape(name ?? null)}, ${sqlEscape(email ?? null)}, ${sqlEscape(phone ?? null)});

-- Correlo con:
--   npx wrangler d1 execute vendepro-db --remote --command "<la sentencia de arriba>"

-- URL para el Panel del Anunciante de ${portal}:
--   ${API_BASE}/feed/${token}.xml
`)
}

async function check([url]) {
  if (!url) die('Uso: portal-feed.mjs check <url-del-feed>')

  const started = Date.now()
  const res = await fetch(url)
  const elapsed = Date.now() - started

  if (!res.ok) die(`HTTP ${res.status} ${res.statusText} — el portal vería lo mismo.`)

  const xml = await res.text()
  const contentType = res.headers.get('content-type') ?? ''

  console.log(`\n  HTTP ${res.status} en ${elapsed}ms — ${(xml.length / 1024).toFixed(1)} KB`)
  console.log(`  Content-Type: ${contentType}`)
  console.log(`  Avisos incluidos: ${res.headers.get('x-feed-items') ?? '?'}`)
  console.log(`  Propiedades omitidas: ${res.headers.get('x-feed-skipped') ?? '?'}`)

  const problems = []
  if (!contentType.includes('xml')) problems.push('El Content-Type no declara XML.')
  if (!xml.startsWith('<?xml')) problems.push('No arranca con la declaración <?xml.')

  const ads = xml.match(/<ad>/g)?.length ?? 0
  const closes = xml.match(/<\/ad>/g)?.length ?? 0
  if (ads !== closes) problems.push(`Tags <ad> desbalanceados: ${ads} abren, ${closes} cierran.`)
  if (ads === 0) problems.push('El feed no tiene ningún aviso — ZonaProp daría de baja todo.')

  // Los caracteres de control prohibidos por XML 1.0 son la causa #1 de que
  // un portal rechace el feed entero sin decir por qué.
  const control = xml.match(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g)
  if (control) problems.push(`Hay ${control.length} caracteres de control ilegales en el XML.`)

  // Un & suelto (no parte de una entidad) rompe el parser.
  const looseAmp = xml.match(/&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)/g)
  if (looseAmp) problems.push(`Hay ${looseAmp.length} "&" sin escapar fuera de CDATA.`)

  const httpImages = xml.match(/<picture_url>http:\/\//g)
  if (httpImages) problems.push(`${httpImages.length} fotos van por http:// — los portales piden https.`)

  if (problems.length > 0) {
    console.log('\n  Problemas:')
    for (const p of problems) console.log(`    ✗ ${p}`)
    console.log('')
    process.exit(1)
  }

  console.log(`\n  ✓ Feed válido con ${ads} avisos. Listo para cargar en el portal.\n`)
}

const [command, ...rest] = process.argv.slice(2)

if (command === 'create') create(rest)
else if (command === 'check') await check(rest)
else die('Comandos: create | check')
