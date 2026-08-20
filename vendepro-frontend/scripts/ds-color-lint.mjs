#!/usr/bin/env node
/**
 * Lint del design system: evita que CREZCA el uso de colores Tailwind semánticos
 * sueltos (emerald/green/red/blue/amber/yellow) en src/app y src/components.
 * Deben ir por tokens o componentes del DS (primary, success/danger/info, Badge,
 * Alert, StageBadge…).
 *
 * Es un "ratchet" con baseline: como la migración está en curso, no falla por las
 * ocurrencias existentes; falla sólo si el total SUBE del baseline. Al migrar
 * baja el número → actualizá scripts/.ds-color-baseline.
 *
 * Excluye: líneas con `ds-todo` (deuda ya marcada), la galería /design-system
 * (muestra colores a propósito), y las superficies que renderizan un documento
 * para un cliente EXTERNO (no la app interna) — tienen identidad visual propia
 * por org/propiedad, no siguen el DS: tasaciones/renderer, tasaciones/legacy,
 * landings/public, landings/blocks. Ver doc/ds-visual-rules.md.
 */
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const ROOTS = ['src/app', 'src/components']
const EXCLUDE_DIR_NAMES = new Set(['design-system', '__tests__'])
const EXCLUDE_PATH_PREFIXES = [
  'src/components/tasaciones/renderer',
  'src/components/tasaciones/legacy',
  'src/components/landings/public',
  'src/components/landings/blocks',
  // Superficies públicas: subsistema propio, no siguen el DS de la app.
  // Ver regla 12 en doc/ds-visual-rules.md.
  'src/app/l/',
  'src/app/p/',
  'src/app/r/',
  'src/app/t/',
  'src/app/u/',
  'src/app/v/',
  'src/app/terminos',
  'src/app/page.tsx',
  // Primitivos del propio DS: acá SÍ viven los colores reales (son la fuente
  // de los tokens), no son "drift" a migrar.
  'src/components/ui',
]
const PATTERN = /(bg|text|border)-(emerald|green|red|blue|amber|yellow)-(50|100|[2-9]00)/
const BASELINE_FILE = 'scripts/.ds-color-baseline'
const baseline = existsSync(BASELINE_FILE) ? Number(readFileSync(BASELINE_FILE, 'utf8').trim() || '0') : 0

function walk(dir) {
  let out = []
  for (const entry of readdirSync(dir)) {
    if (EXCLUDE_DIR_NAMES.has(entry)) continue
    const p = join(dir, entry)
    if (EXCLUDE_PATH_PREFIXES.some(prefix => p.startsWith(prefix))) continue
    if (statSync(p).isDirectory()) out = out.concat(walk(p))
    else if (p.endsWith('.tsx')) out.push(p)
  }
  return out
}

const hits = []
for (const root of ROOTS) {
  for (const file of walk(root)) {
    readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
      if (line.includes('ds-todo')) return
      if (PATTERN.test(line)) hits.push(`${file}:${i + 1}`)
    })
  }
}

const count = hits.length
console.log(`DS color lint · colores semánticos sueltos en ${ROOTS.join(' + ')}: ${count} (baseline ${baseline})`)

if (count > baseline) {
  console.error(`\n✗ Subió +${count - baseline}. Usá tokens/componentes del DS (primary, success/danger/info, Badge, Alert, StageBadge, OperationBadge…), no color Tailwind suelto.`)
  hits.slice(-Math.min(15, count - baseline)).forEach(h => console.error('  ' + h))
  process.exit(1)
}
if (count < baseline) {
  console.log(`✓ Bajó ${baseline - count}. Actualizá ${BASELINE_FILE} a ${count} para trabar el avance.`)
}
process.exit(0)
