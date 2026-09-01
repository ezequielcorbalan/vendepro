#!/usr/bin/env node
/**
 * Lint del design system. Dos ratchets, mismo espíritu: nada de esto puede CRECER.
 *
 * 1. Colores Tailwind sueltos en src/app y src/components. Deben ir por tokens o
 *    componentes del DS (primary, success/danger/info, Badge, Alert, StageBadge…).
 *    El patrón cubre TODA la paleta menos los neutros (gray/zinc/stone/neutral),
 *    porque medir sólo los semánticos obvios dejaba afuera 52 casos: `rose-500`
 *    es un segundo rojo y `pink-*` un segundo primary, y no los contaba nadie.
 * 2. Medallones de gradiente armados a mano. El gradiente de marca dejó de ser
 *    el color por default de un ícono: va `IconMedallion` con un `tone`, o
 *    `WidgetHeader`, que ya lo trae. Ver regla 14 de doc/ds-visual-rules.md.
 * 3. Íconos escritos como carácter o emoji en un texto de UI (✓ Guardado,
 *    "📱 Móvil"). Van como ícono de lucide, que escala, hereda color y se lee
 *    igual en todos los sistemas. Ver regla 20.
 * 4b. Radios pre-token (`rounded-lg`/`xl`). El DS tiene `rounded-control` (8px)
 *    y `rounded-card` (12px) — regla 8. Baseline 0 para lg/xl; los 2xl/3xl que
 *    quedan sí cambian de tamaño al migrar, así que se deciden a mano.
 * 4. La escala `slate`. El DS usa `gray`. El módulo de tasaciones estaba escrito
 *    entero en slate —258 usos— así que sus grises tenían un tinte azulado que
 *    el resto de la app no tiene. Baseline 0: ya no queda ninguno.
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
  // Reporte público de propiedad: mismo caso que los de arriba —es un documento
  // para el cliente, no la app interna. AFUERA POR AHORA, no resuelto: son 11
  // colores sueltos que siguen ahí. Ver "Deuda anotada" en doc/ds-visual-rules.md.
  'src/app/r',
  // Primitivos del propio DS: acá SÍ viven los colores reales (son la fuente
  // de los tokens), no son "drift" a migrar.
  'src/components/ui',
]
const PATTERN = /(bg|text|border|ring|divide|from|to|via)-(emerald|green|red|blue|amber|yellow|rose|pink|purple|violet|fuchsia|indigo|cyan|sky|teal|lime|orange)-(50|100|[2-9]00)/
// El gradiente de marca como relleno de una caja de ícono. Sigue permitido como
// SUPERFICIE (ProgressBar, StepIndicator, placeholder de PropertyCard), que
// viven en src/components/ui y están excluidos más arriba.
const GRADIENT_PATTERN = /bg-gradient-to-\w+ from-brand-pink/
const BASELINE_FILE = 'scripts/.ds-color-baseline'
const GRADIENT_BASELINE_FILE = 'scripts/.ds-gradient-baseline'
// Vistos, cruces y emoji dentro de un string o de texto JSX. NO incluye flechas
// (→ ← ↑ ↓): en prosa son tipografía legítima ("Configuración → Ayuda"), no un
// ícono disfrazado. Tampoco mira `emoji:`, que en los bloques de landing es un
// campo de contenido del cliente, no UI.
const GLYPH_PATTERN = /[\u2713\u2714\u2715\u2716\u2717\u2718\u2705\u274C\u274E\u{1F300}-\u{1FAFF}]/u
const GLYPH_BASELINE_FILE = 'scripts/.ds-glyph-baseline'
// Pide el prefijo de utilidad para no matchear `-translate-y-1/2`, que contiene
// la cadena "slate-" y son 30 falsos positivos.
const SLATE_PATTERN = /(bg|text|border|ring|divide|placeholder|from|to|via|outline|decoration|accent|caret|fill|stroke)-slate-\d+/
const SLATE_BASELINE_FILE = 'scripts/.ds-slate-baseline'
const RADIUS_PATTERN = /rounded-(lg|xl)\b/
const RADIUS_BASELINE_FILE = 'scripts/.ds-radius-baseline'
const baseline = existsSync(BASELINE_FILE) ? Number(readFileSync(BASELINE_FILE, 'utf8').trim() || '0') : 0
const gradientBaseline = existsSync(GRADIENT_BASELINE_FILE) ? Number(readFileSync(GRADIENT_BASELINE_FILE, 'utf8').trim() || '0') : 0
const glyphBaseline = existsSync(GLYPH_BASELINE_FILE) ? Number(readFileSync(GLYPH_BASELINE_FILE, 'utf8').trim() || '0') : 0
const slateBaseline = existsSync(SLATE_BASELINE_FILE) ? Number(readFileSync(SLATE_BASELINE_FILE, 'utf8').trim() || '0') : 0
const radiusBaseline = existsSync(RADIUS_BASELINE_FILE) ? Number(readFileSync(RADIUS_BASELINE_FILE, 'utf8').trim() || '0') : 0

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
const gradientHits = []
const glyphHits = []
const slateHits = []
const radiusHits = []
for (const root of ROOTS) {
  for (const file of walk(root)) {
    readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
      if (line.includes('ds-todo')) return
      if (PATTERN.test(line)) hits.push(`${file}:${i + 1}`)
      if (GRADIENT_PATTERN.test(line)) gradientHits.push(`${file}:${i + 1}`)
      if (GLYPH_PATTERN.test(line) && !line.includes('emoji')) glyphHits.push(`${file}:${i + 1}`)
      if (SLATE_PATTERN.test(line)) slateHits.push(`${file}:${i + 1}`)
      if (RADIUS_PATTERN.test(line)) radiusHits.push(`${file}:${i + 1}`)
    })
  }
}

const count = hits.length
console.log(`DS color lint · colores Tailwind sueltos en ${ROOTS.join(' + ')}: ${count} (baseline ${baseline})`)

const gradientCount = gradientHits.length
const glyphCount = glyphHits.length
console.log(`DS color lint · medallones de gradiente a mano: ${gradientCount} (baseline ${gradientBaseline})`)
const slateCount = slateHits.length
const radiusCount = radiusHits.length
console.log(`DS color lint · íconos escritos como carácter/emoji: ${glyphCount} (baseline ${glyphBaseline})`)
console.log(`DS color lint · escala slate en vez de gray: ${slateCount} (baseline ${slateBaseline})`)
console.log(`DS color lint · radios pre-token (rounded-lg/xl): ${radiusCount} (baseline ${radiusBaseline})`)

let failed = false

if (radiusCount > radiusBaseline) {
  console.error(`\n✗ Subió +${radiusCount - radiusBaseline}. Usá \`rounded-control\` (8px) o \`rounded-card\` (12px) — regla 8.`)
  radiusHits.slice(-Math.min(15, radiusCount - radiusBaseline)).forEach(h => console.error('  ' + h))
  failed = true
}
if (radiusCount < radiusBaseline) {
  console.log(`✓ Bajó ${radiusBaseline - radiusCount}. Actualizá ${RADIUS_BASELINE_FILE} a ${radiusCount}.`)
}

if (slateCount > slateBaseline) {
  console.error(`\n✗ Subió +${slateCount - slateBaseline}. El DS usa la escala \`gray\`, no \`slate\`.`)
  slateHits.slice(-Math.min(15, slateCount - slateBaseline)).forEach(h => console.error('  ' + h))
  failed = true
}
if (slateCount < slateBaseline) {
  console.log(`✓ Bajó ${slateBaseline - slateCount}. Actualizá ${SLATE_BASELINE_FILE} a ${slateCount}.`)
}

if (glyphCount > glyphBaseline) {
  console.error(`\n✗ Subió +${glyphCount - glyphBaseline}. Usá un ícono de lucide, no un carácter (regla 20).`)
  glyphHits.slice(-Math.min(15, glyphCount - glyphBaseline)).forEach(h => console.error('  ' + h))
  failed = true
}
if (glyphCount < glyphBaseline) {
  console.log(`✓ Bajó ${glyphBaseline - glyphCount}. Actualizá ${GLYPH_BASELINE_FILE} a ${glyphCount}.`)
}

if (gradientCount > gradientBaseline) {
  console.error(`\n✗ Subió +${gradientCount - gradientBaseline}. Usá <IconMedallion tone="..."> o <WidgetHeader>, no un gradiente a mano (regla 14).`)
  gradientHits.slice(-Math.min(15, gradientCount - gradientBaseline)).forEach(h => console.error('  ' + h))
  failed = true
}
if (gradientCount < gradientBaseline) {
  console.log(`✓ Bajó ${gradientBaseline - gradientCount}. Actualizá ${GRADIENT_BASELINE_FILE} a ${gradientCount}.`)
}

if (count > baseline) {
  console.error(`\n✗ Subió +${count - baseline}. Usá tokens/componentes del DS (primary, success/danger/info, Badge, Alert, StageBadge, OperationBadge…), no color Tailwind suelto.`)
  hits.slice(-Math.min(15, count - baseline)).forEach(h => console.error('  ' + h))
  failed = true
}
if (count < baseline) {
  console.log(`✓ Bajó ${baseline - count}. Actualizá ${BASELINE_FILE} a ${count} para trabar el avance.`)
}
process.exit(failed ? 1 : 0)
