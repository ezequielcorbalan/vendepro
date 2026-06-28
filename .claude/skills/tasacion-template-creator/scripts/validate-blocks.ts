/**
 * Valida el blocks_json de un template de tasación contra el Zod REAL del backend.
 *
 * Reutiliza `validateAppraisalBlocks` de @vendepro/core → cero drift con producción.
 *
 * Uso (desde la raíz del repo):
 *   npx -y tsx .claude/skills/tasacion-template-creator/scripts/validate-blocks.ts <archivo>
 *
 * <archivo> puede ser:
 *   - un .json con el array de bloques  → se valida directo
 *   - un .sql de migración              → se extraen TODOS los blocks_json y se validan
 *
 * Exit 0 = todo válido. Exit 1 = algún bloque inválido o error de lectura.
 *
 * Si `tsx` no está instalado, `npx -y tsx` lo descarga solo (force install).
 * Si falla por falta de node_modules/zod, instalá deps: `cd vendepro-backend && npm install`.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve, extname } from 'node:path'
import { validateAppraisalBlocks } from '../../../../vendepro-backend/packages/core/src/domain/value-objects/appraisal-block-schemas.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))

function fail(msg: string): never {
  console.error(`\x1b[31m✗ ${msg}\x1b[0m`)
  process.exit(1)
}

/** Extrae todos los string literals SQL ('...' con '' como escape) del texto. */
function extractSqlStrings(sql: string): string[] {
  const out: string[] = []
  let i = 0
  while (i < sql.length) {
    if (sql[i] === "'") {
      i++
      let buf = ''
      while (i < sql.length) {
        if (sql[i] === "'") {
          if (sql[i + 1] === "'") { buf += "'"; i += 2; continue } // '' escapado
          i++; break // fin del literal
        }
        buf += sql[i]; i++
      }
      out.push(buf)
    } else {
      i++
    }
  }
  return out
}

const arg = process.argv[2]
if (!arg) fail('Falta el archivo a validar. Uso: validate-blocks.ts <archivo.json|.sql>')

const path = resolve(process.cwd(), arg)
let raw: string
try {
  raw = readFileSync(path, 'utf8')
} catch {
  fail(`No pude leer el archivo: ${path}`)
}

type Candidate = { label: string; json: string }
const candidates: Candidate[] = []

if (extname(path) === '.sql') {
  const literals = extractSqlStrings(raw).filter((s) => s.trimStart().startsWith('['))
  if (literals.length === 0) fail('No encontré ningún blocks_json (array que arranca con "[") en el .sql')
  literals.forEach((json, idx) => candidates.push({ label: `blocks_json #${idx + 1}`, json }))
} else {
  candidates.push({ label: 'blocks_json', json: raw })
}

let allOk = true
for (const c of candidates) {
  let parsed: unknown
  try {
    parsed = JSON.parse(c.json)
  } catch (e) {
    allOk = false
    console.error(`\x1b[31m✗ ${c.label}: JSON inválido — ${(e as Error).message}\x1b[0m`)
    continue
  }
  const r = validateAppraisalBlocks(parsed)
  if (r.success) {
    console.log(`\x1b[32m✓ ${c.label}: ${r.data.length} bloque(s) válido(s)\x1b[0m`)
  } else {
    allOk = false
    console.error(`\x1b[31m✗ ${c.label}: ${r.error}\x1b[0m`)
  }
}

if (!allOk) process.exit(1)
console.log('\x1b[32m✓ Template válido.\x1b[0m')
