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
 * 4. Overlays armados a mano: un scrim (`inset-0` con fondo translúcido) fuera
 *    de `components/ui`. Van con `ui/Modal` o `ui/Drawer`, que traen Portal,
 *    scroll-lock, focus-trap, devolución de foco y Esc. Ver la fase 6 en
 *    doc/ds-plan-fase6.md; el contrato que tienen que cumplir está testeado en
 *    components/ui/__tests__/overlay-contract.tsx.
 * 5. La escala `slate`. El DS usa `gray`. El módulo de tasaciones estaba escrito
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
import { spawnSync } from 'node:child_process'
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
// Scrim de overlay: `inset-0` con un fondo translúcido. NO cuenta el
// `inset-0` transparente que sirve de atrapa-clicks de un dropdown, que es un
// uso legítimo.
const OVERLAY_PATTERN = /inset-0[^"'`]*(bg-(black|slate|gray|neutral|white)\/|backdrop-blur)/
const OVERLAY_BASELINE_FILE = 'scripts/.ds-overlay-baseline'
const RADIUS_PATTERN = /rounded-(lg|xl)\b/
const RADIUS_BASELINE_FILE = 'scripts/.ds-radius-baseline'
// `Text` del DS sin importar. Es el único componente cuyo nombre choca con un
// global del DOM (`declare var Text` en lib.dom), así que olvidar el import NO
// falla en `tsc --noEmit`: falla en el navegador, al renderizar. Pasó una vez
// migrando un overlay de leads y el chequeo estaba verde.
const TEXT_USE_PATTERN = /<Text[\s>/]/
const TEXT_IMPORT_PATTERN = /^\s*import\s[^;]*\bText\b/m
const TEXT_BASELINE_FILE = 'scripts/.ds-text-import-baseline'
const baseline = existsSync(BASELINE_FILE) ? Number(readFileSync(BASELINE_FILE, 'utf8').trim() || '0') : 0
const gradientBaseline = existsSync(GRADIENT_BASELINE_FILE) ? Number(readFileSync(GRADIENT_BASELINE_FILE, 'utf8').trim() || '0') : 0
const glyphBaseline = existsSync(GLYPH_BASELINE_FILE) ? Number(readFileSync(GLYPH_BASELINE_FILE, 'utf8').trim() || '0') : 0
const slateBaseline = existsSync(SLATE_BASELINE_FILE) ? Number(readFileSync(SLATE_BASELINE_FILE, 'utf8').trim() || '0') : 0
const overlayBaseline = existsSync(OVERLAY_BASELINE_FILE) ? Number(readFileSync(OVERLAY_BASELINE_FILE, 'utf8').trim() || '0') : 0
const radiusBaseline = existsSync(RADIUS_BASELINE_FILE) ? Number(readFileSync(RADIUS_BASELINE_FILE, 'utf8').trim() || '0') : 0
const textBaseline = existsSync(TEXT_BASELINE_FILE) ? Number(readFileSync(TEXT_BASELINE_FILE, 'utf8').trim() || '0') : 0

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
const overlayHits = []
const radiusHits = []
const textHits = []
for (const root of ROOTS) {
  for (const file of walk(root)) {
    const fuente = readFileSync(file, 'utf8')
    // Este chequeo es por archivo, no por línea: lo que falta es el import.
    if (TEXT_USE_PATTERN.test(fuente) && !TEXT_IMPORT_PATTERN.test(fuente)) {
      const linea = fuente.split('\n').findIndex(l => TEXT_USE_PATTERN.test(l)) + 1
      textHits.push(`${file}:${linea}`)
    }
    fuente.split('\n').forEach((line, i) => {
      if (line.includes('ds-todo')) return
      if (PATTERN.test(line)) hits.push(`${file}:${i + 1}`)
      if (GRADIENT_PATTERN.test(line)) gradientHits.push(`${file}:${i + 1}`)
      if (GLYPH_PATTERN.test(line) && !line.includes('emoji')) glyphHits.push(`${file}:${i + 1}`)
      if (SLATE_PATTERN.test(line)) slateHits.push(`${file}:${i + 1}`)
      if (OVERLAY_PATTERN.test(line)) overlayHits.push(`${file}:${i + 1}`)
      if (RADIUS_PATTERN.test(line)) radiusHits.push(`${file}:${i + 1}`)
    })
  }
}

const count = hits.length

const gradientCount = gradientHits.length
const glyphCount = glyphHits.length
const slateCount = slateHits.length
const overlayCount = overlayHits.length
const radiusCount = radiusHits.length

/**
 * Archivos que cambió esta rama respecto de main. Sirve para señalar al culpable
 * de verdad cuando un contador sube.
 *
 * La versión anterior mostraba `hits.slice(-N)` —los últimos N hits en orden de
 * recorrido— y eso NO son los nuevos: cuando el ratchet de color subió +2 por dos
 * `text-red-500` en landings/InspectorPanel, el reporte apuntó a
 * reports/NeighborhoodBenchmarkTable y sold-properties/SoldPropertyForm, que no
 * habían cambiado. Un guard que señala mal al culpable hace perder más tiempo del
 * que ahorra.
 */
function archivosTocados() {
  const git = (...args) => {
    const r = spawnSync('git', args, { encoding: 'utf8' })
    return r.status === 0 ? r.stdout.trim() : null
  }
  const encontrados = new Set()
  const sumar = out => {
    if (!out) return
    for (const f of out.split('\n')) {
      if (f.startsWith('vendepro-frontend/src/') || f.startsWith('vendepro-frontend/scripts/')) {
        encontrados.add(f.replace(/^vendepro-frontend\//, ''))
      }
    }
  }

  // UNA sola base, la primera que resuelva. Unir varias es un error: el `main`
  // local puede estar muy atrasado y entonces `main...HEAD` devuelve cientos de
  // archivos, con lo cual "los hits de tu rama" pasa a ser "todos los hits".
  const base = ['origin/main', 'main'].find(b => git('rev-parse', '--verify', '--quiet', b))
  if (base) sumar(git('diff', '--name-only', `${base}...HEAD`))

  // Y lo que está sin commitear: si sólo mirara lo commiteado, no vería el
  // archivo que estás editando ahora, que es justo cuando el linter tiene que
  // ayudarte.
  sumar(git('diff', '--name-only', 'HEAD'))
  sumar(git('diff', '--name-only', '--cached'))

  return encontrados.size > 0 ? encontrados : null
}
const TOCADOS = archivosTocados()

/** Un ratchet: informa, y falla sólo si el contador SUBE del baseline. */
function ratchet({ etiqueta, hits, baseline, archivo, sugerencia }) {
  const count = hits.length
  console.log(`DS lint · ${etiqueta}: ${count} (baseline ${baseline})`)
  if (count > baseline) {
    console.error(`\n✗ ${etiqueta} subió +${count - baseline}. ${sugerencia}`)
    const enTuDiff = TOCADOS ? hits.filter(h => TOCADOS.has(h.split(':')[0])) : []
    if (enTuDiff.length > 0) {
      console.error('  Hits en archivos que tocó esta rama:')
      enTuDiff.slice(0, 15).forEach(h => console.error('    ' + h))
      if (enTuDiff.length > 15) console.error(`    …y ${enTuDiff.length - 15} más`)
    } else {
      console.error(TOCADOS
        ? '  Ningún hit cae en un archivo de esta rama — puede venir de un merge. Todos los hits actuales:'
        : '  (sin base de comparación git; todos los hits actuales)')
      hits.slice(0, 15).forEach(h => console.error('    ' + h))
      if (hits.length > 15) console.error(`    …y ${hits.length - 15} más`)
    }
    return true
  }
  if (count < baseline) {
    console.log(`✓ Bajó ${baseline - count}. Actualizá ${archivo} a ${count}.`)
  }
  return false
}

const resultados = [
  ratchet({
    etiqueta: 'colores Tailwind sueltos', hits, baseline, archivo: BASELINE_FILE,
    sugerencia: 'Usá tokens/componentes del DS (primary, success/danger/info, Badge, Alert, StageBadge…), no color Tailwind suelto.',
  }),
  ratchet({
    etiqueta: 'medallones de gradiente a mano', hits: gradientHits, baseline: gradientBaseline, archivo: GRADIENT_BASELINE_FILE,
    sugerencia: 'Usá <IconMedallion tone="..."> o <WidgetHeader>, no un gradiente a mano (regla 14).',
  }),
  ratchet({
    etiqueta: 'íconos escritos como carácter/emoji', hits: glyphHits, baseline: glyphBaseline, archivo: GLYPH_BASELINE_FILE,
    sugerencia: 'Usá un ícono de lucide, no un carácter (regla 20).',
  }),
  ratchet({
    etiqueta: 'escala slate en vez de gray', hits: slateHits, baseline: slateBaseline, archivo: SLATE_BASELINE_FILE,
    sugerencia: 'El DS usa la escala `gray`, no `slate` (regla 21).',
  }),
  ratchet({
    etiqueta: 'overlays armados a mano', hits: overlayHits, baseline: overlayBaseline, archivo: OVERLAY_BASELINE_FILE,
    sugerencia: 'Usá <Modal> o <Drawer> del DS: traen Portal, scroll-lock, focus-trap y Esc (fase 6).',
  }),
  ratchet({
    etiqueta: 'radios pre-token (rounded-lg/xl)', hits: radiusHits, baseline: radiusBaseline, archivo: RADIUS_BASELINE_FILE,
    sugerencia: 'Usá `rounded-control` (8px) o `rounded-card` (12px) — regla 8.',
  }),
  ratchet({
    etiqueta: '<Text> sin importar (rompe en runtime, no en tsc)', hits: textHits, baseline: textBaseline, archivo: TEXT_BASELINE_FILE,
    sugerencia: "Importá Text de '@/components/ui/Typography'. Sin el import tomás el `Text` del DOM y la pantalla explota al renderizar.",
  }),
]

process.exit(resultados.some(Boolean) ? 1 : 0)
