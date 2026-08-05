'use client'
import { useEffect, useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
import type { TemplateBlock, BindingMode, AppraisalBlockType } from '../renderer/types'
import { BlockForm } from '../editor/BlockForm'
import {
  STATIC_BLOCK_TYPES,
  loadStaticBlockDefaults,
  type StaticBlockDefaultsMap,
} from '../shared/static-block-defaults'

const BINDING_MODE_OPTIONS: { value: BindingMode; label: string; hint: string }[] = [
  {
    value: 'system',
    label: 'Texto fijo del sistema',
    hint: 'Mismo contenido para todas las inmobiliarias. Lo define VendéPro.',
  },
  {
    value: 'org-static',
    label: 'Texto fijo de la inmobiliaria',
    hint: 'Texto que cargás vos una vez y se repite igual en todas las tasaciones de tu inmobiliaria.',
  },
  {
    value: 'org-variable',
    label: 'Variables de la inmobiliaria',
    hint: 'Usa valores guardados en Variables (ej: estadísticas de mercado, datos institucionales).',
  },
  {
    value: 'tasacion',
    label: 'Datos de cada tasación',
    hint: 'Se completa por separado en cada tasación que crees (ej: FODA, dirección, comparables).',
  },
  {
    value: 'default-override',
    label: 'Valor por defecto editable',
    hint: 'Trae un valor sugerido pero el asesor puede modificarlo en cada tasación.',
  },
]

const PDF_LOCKED: Set<AppraisalBlockType> = new Set([
  'cover', 'property_data', 'swot', 'price_projection',
  'video_gallery', 'extra_media', 'cta_whatsapp', 'agent_contact_card',
])

// Modos que se benefician del default guardado por la inmobiliaria.
const APPLIES_DEFAULTS: Set<BindingMode> = new Set(['org-static', 'default-override'])

// Cache de defaults para evitar recargar en cada bloque del template.
let defaultsCache: StaticBlockDefaultsMap | null = null
let defaultsPromise: Promise<StaticBlockDefaultsMap> | null = null
function getStaticDefaults(): Promise<StaticBlockDefaultsMap> {
  if (defaultsCache) return Promise.resolve(defaultsCache)
  if (defaultsPromise) return defaultsPromise
  defaultsPromise = loadStaticBlockDefaults()
    .then(d => { defaultsCache = d; return d })
    .catch(e => { defaultsPromise = null; throw e })
  return defaultsPromise
}
/** Para que las nuevas pantallas (StaticBlocksHome) puedan invalidar el cache. */
export function _invalidateStaticDefaultsCache() {
  defaultsCache = null
  defaultsPromise = null
}

interface Props {
  block: TemplateBlock
  onPatchBlock: (patch: Partial<TemplateBlock>) => void
  onPatchData: (patch: Record<string, unknown>) => void
  onRemove: () => void
}

export function BlockAdminForm({ block, onPatchBlock, onPatchData, onRemove }: Props) {
  const pdfLocked = PDF_LOCKED.has(block.type)
  const currentMode = BINDING_MODE_OPTIONS.find(m => m.value === block.binding_mode)

  const canApplyDefaults =
    APPLIES_DEFAULTS.has(block.binding_mode) &&
    (STATIC_BLOCK_TYPES as AppraisalBlockType[]).includes(block.type)

  const [hasDefaults, setHasDefaults] = useState<boolean | null>(null)
  const [applying, setApplying] = useState(false)
  const [applyError, setApplyError] = useState<string | null>(null)

  useEffect(() => {
    if (!canApplyDefaults) { setHasDefaults(null); return }
    let cancelled = false
    getStaticDefaults()
      .then(d => { if (!cancelled) setHasDefaults(!!d[block.type]) })
      .catch(() => { if (!cancelled) setHasDefaults(false) })
    return () => { cancelled = true }
  }, [canApplyDefaults, block.type])

  const applyDefaults = async () => {
    setApplying(true); setApplyError(null)
    try {
      const map = await getStaticDefaults()
      const entry = map[block.type]
      if (!entry) {
        setApplyError('No hay valores guardados para este bloque.')
        setHasDefaults(false)
      } else {
        onPatchData(entry.data)
      }
    } catch (e: any) {
      setApplyError(e?.message ?? 'Error al cargar defaults')
    } finally {
      setApplying(false)
    }
  }
  return (
    <div className="space-y-3 border-t border-slate-200 p-3">
      <div className="flex flex-wrap items-start gap-3">
        <label className="flex flex-1 flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">
            ¿De dónde sale el contenido?
          </span>
          <select
            value={block.binding_mode}
            onChange={e => onPatchBlock({ binding_mode: e.target.value as BindingMode })}
            className="rounded border border-slate-300 px-2 py-1.5 text-sm"
          >
            {BINDING_MODE_OPTIONS.map(m => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
          {currentMode && (
            <span className="mt-1 text-xs leading-snug text-slate-500">{currentMode.hint}</span>
          )}
        </label>
        <label className="flex items-center gap-2 pt-7 text-sm">
          <input
            type="checkbox"
            disabled={pdfLocked}
            checked={block.include_in_pdf}
            onChange={e => onPatchBlock({ include_in_pdf: e.target.checked })}
          />
          <span
            className={pdfLocked ? 'text-slate-400' : ''}
            title={pdfLocked ? 'Este bloque siempre se incluye en el PDF' : ''}
          >
            Incluir en PDF
          </span>
        </label>
        <button
          onClick={onRemove}
          className="ml-auto pt-7 text-xs text-rose-500 hover:text-rose-700"
        >
          Eliminar
        </button>
      </div>
      {canApplyDefaults && (
        <div className="flex flex-wrap items-center gap-2 rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
          <span className="text-slate-600">
            Hay valores guardados en{' '}
            <strong className="text-ink">Bloques estáticos</strong>:
          </span>
          <button
            type="button"
            onClick={applyDefaults}
            disabled={applying || hasDefaults === false}
            title={hasDefaults === false ? 'Todavía no configuraste defaults para este tipo de bloque.' : undefined}
            className="flex items-center gap-1 rounded border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:border-brand-pink hover:text-brand-pink disabled:opacity-40"
          >
            {applying ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
            Aplicar valores guardados
          </button>
          {hasDefaults === false && (
            <span className="text-slate-400">Configurarlos en Configuración → Tasaciones → Bloques estáticos.</span>
          )}
          {applyError && <span className="text-rose-600">{applyError}</span>}
        </div>
      )}
      <BlockForm block={block} override={{}} onPatch={onPatchData} context="template" />
    </div>
  )
}
