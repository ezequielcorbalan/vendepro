#!/usr/bin/env node
/**
 * Lint del design system: evita que CREZCA el uso de colores Tailwind semánticos
 * sueltos (emerald/green/red/blue/amber/yellow) en src/app. Deben ir por tokens
 * o componentes del DS (primary, success/danger/info, Badge, Alert, StageBadge…).
 *
 * Es un "ratchet" con baseline: como la migración está en curso, no falla por las
 * ocurrencias existentes; falla sólo si el total SUBE del baseline. Al migrar
 * baja el número → actualizá scripts/.ds-color-baseline.
 *
 * Excluye: líneas con `ds-todo` (deuda ya marcada) y la galería /design-system
 * (muestra colores a propósito).
 */
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = 'src/app'
const EXCLUDE_DIRS = new Set(['design-system'])
const PATTERN = /(bg|text|border)-(emerald|green|red|blue|amber|yellow)-(50|100|[2-9]00)/
const BASELINE_FILE = 'scripts/.ds-color-baseline'
const baseline = existsSync(BASELINE_FILE) ? Number(readFileSync(BASELINE_FILE, 'utf8').trim() || '0') : 0

function walk(dir) {
  let out = []
  for (const entry of readdirSync(dir)) {
    if (EXCLUDE_DIRS.has(entry)) continue
    const p = join(dir, entry)
    if (statSync(p).isDirectory()) out = out.concat(walk(p))
    else if (p.endsWith('.tsx')) out.push(p)
  }
  return out
}

const hits = []
for (const file of walk(ROOT)) {
  readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
    if (line.includes('ds-todo')) return
    if (PATTERN.test(line)) hits.push(`${file}:${i + 1}`)
  })
}

const count = hits.length
console.log(`DS color lint · colores semánticos sueltos en ${ROOT}: ${count} (baseline ${baseline})`)

if (count > baseline) {
  console.error(`\n✗ Subió +${count - baseline}. Usá tokens/componentes del DS (primary, success/danger/info, Badge, Alert, StageBadge, OperationBadge…), no color Tailwind suelto.`)
  hits.slice(-Math.min(15, count - baseline)).forEach(h => console.error('  ' + h))
  process.exit(1)
}
if (count < baseline) {
  console.log(`✓ Bajó ${baseline - count}. Actualizá ${BASELINE_FILE} a ${count} para trabar el avance.`)
}
process.exit(0)
