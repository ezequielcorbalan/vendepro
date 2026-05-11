'use client'
import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, Info, Loader2, Lock } from 'lucide-react'
import { getTemplate } from '../../shared/api'
import { BlockForm } from '../../editor/BlockForm'
import { getBlockMeta } from '../../renderer/block-catalog'
import {
  APPRAISAL_BLOCK_TYPES,
  type TemplateBlock,
  type BlockOverrides,
  type AppraisalBlockType,
} from '../../renderer/types'
import type { CustomBlock } from '../use-wizard-form'

interface Props {
  templateId: string | null
  overrides: BlockOverrides
  onPatchOverride: (blockId: string, patch: Record<string, unknown>) => void
  // From-scratch mode
  customBlocks: CustomBlock[]
  onToggleCustomBlock: (type: AppraisalBlockType) => void
  onPatchCustomBlock: (type: AppraisalBlockType, patch: Record<string, unknown>) => void
}

const AUTO_RESOLVED_TYPES = new Set<AppraisalBlockType>([
  'swot',
  'property_data',
  'comparables_list',
  'price_projection',
])

// Mensaje contextual para los bloques que se llenan automáticamente con datos
// de pasos previos del wizard.
const AUTO_FILL_HINT: Partial<Record<AppraisalBlockType, string>> = {
  swot: 'Se completa con los datos del paso "FODA + Precios".',
  price_projection: 'Se completa con los datos del paso "FODA + Precios".',
  property_data: 'Se completa con los datos del paso "Propiedad".',
  comparables_list: 'Se completa con los datos del paso "Competencia".',
}

type BlockUiCategory = 'editable' | 'auto_filled' | 'static'

function categorizeBlock(b: TemplateBlock): BlockUiCategory {
  // Bloques no editables por tasación (vienen del template / org / system)
  if (b.binding_mode !== 'tasacion' && b.binding_mode !== 'default-override') return 'static'
  // Bloques que el wizard llena solo en otros pasos
  if (AUTO_RESOLVED_TYPES.has(b.type)) return 'auto_filled'
  const src = (b.data as any)?.source
  if (typeof src === 'string' && src.startsWith('appraisal.')) return 'auto_filled'
  return 'editable'
}

function autoFillNote(b: TemplateBlock): string {
  const byType = AUTO_FILL_HINT[b.type]
  if (byType) return byType
  const src = (b.data as any)?.source
  if (typeof src === 'string' && src.startsWith('appraisal.')) {
    return 'Se completa automáticamente con los datos de la tasación.'
  }
  return 'Se completa automáticamente.'
}

export function StepVariableBlocks({
  templateId,
  overrides,
  onPatchOverride,
  customBlocks,
  onToggleCustomBlock,
  onPatchCustomBlock,
}: Props) {
  // ── Modo "desde cero" ─────────────────────────────────────
  if (!templateId) {
    return (
      <FromScratchBlocks
        customBlocks={customBlocks}
        onToggle={onToggleCustomBlock}
        onPatch={onPatchCustomBlock}
      />
    )
  }

  // ── Modo "con template" ───────────────────────────────────
  return (
    <FromTemplateBlocks
      templateId={templateId}
      overrides={overrides}
      onPatchOverride={onPatchOverride}
    />
  )
}

// ─────────────────────────────────────────────────────────────
// Variante con template existente
// ─────────────────────────────────────────────────────────────

function FromTemplateBlocks({
  templateId,
  overrides,
  onPatchOverride,
}: {
  templateId: string
  overrides: BlockOverrides
  onPatchOverride: (blockId: string, patch: Record<string, unknown>) => void
}) {
  const [blocks, setBlocks] = useState<TemplateBlock[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [hideFixed, setHideFixed] = useState(true)

  useEffect(() => {
    setBlocks(null)
    setError(null)
    setExpanded(new Set())
    getTemplate(templateId)
      .then(t => {
        const all: TemplateBlock[] = (t?.blocks ?? []) as TemplateBlock[]
        setBlocks([...all].sort((a, b) => a.sort_order - b.sort_order))
      })
      .catch(e => setError(e?.message ?? 'No se pudo cargar el template'))
  }, [templateId])

  function toggleExpanded(id: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  if (error) {
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
        {error}
      </div>
    )
  }

  if (blocks === null) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-slate-500">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Cargando bloques…
      </div>
    )
  }

  if (blocks.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
        Este template no tiene bloques configurados. Continuá al siguiente paso.
      </div>
    )
  }

  const editableCount = blocks.filter(b => categorizeBlock(b) === 'editable').length
  const fixedCount = blocks.length - editableCount
  const visibleBlocks = hideFixed
    ? blocks.filter(b => categorizeBlock(b) === 'editable')
    : blocks

  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">
        Estos son todos los bloques del template (los que vas a ver en la previsualización).
        {editableCount > 0 ? (
          <>
            {' '}Completá los que requieran datos propios de esta tasación; los que tienen{' '}
            <Lock className="-mt-0.5 inline h-3 w-3 text-slate-400" /> son estáticos del template y los que tienen{' '}
            <Info className="-mt-0.5 inline h-3 w-3 text-slate-400" /> se completan automáticamente con los pasos anteriores.
          </>
        ) : (
          <>
            {' '}Este template no tiene bloques editables por tasación. Continuá al siguiente paso.
          </>
        )}
      </div>

      {fixedCount > 0 && (
        <div className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-2.5">
          <div>
            <p className="text-sm font-medium text-slate-700">Ocultar bloques fijos</p>
            <p className="text-xs text-slate-500">
              Muestra solo los {editableCount} bloque{editableCount === 1 ? '' : 's'} que podés
              editar acá (oculta los {fixedCount} fijos del template y los autocompletados).
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={hideFixed}
            onClick={() => setHideFixed(v => !v)}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none ${
              hideFixed ? 'bg-[#ff007c]' : 'bg-slate-200'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition-transform ${
                hideFixed ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      )}

      <div className="space-y-2">
        {hideFixed && editableCount === 0 && (
          <p className="rounded-lg border border-dashed border-slate-200 px-4 py-3 text-center text-xs text-slate-400">
            Este template no tiene bloques editables. Desactivá el switch para ver los fijos.
          </p>
        )}
        {visibleBlocks.map(b => {
          const meta = getBlockMeta(b.type)
          const cat = categorizeBlock(b)

          if (cat === 'editable') {
            const open = expanded.has(b.id)
            return (
              <div key={b.id} className="rounded-lg border border-slate-200">
                <button
                  type="button"
                  onClick={() => toggleExpanded(b.id)}
                  className="flex w-full items-start gap-3 px-3 py-2.5 text-left hover:bg-slate-50"
                >
                  {open
                    ? <ChevronDown className="mt-1 h-4 w-4 shrink-0 text-slate-400" />
                    : <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-slate-400" />}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-800">{meta.label}</p>
                    <p className="text-xs text-slate-500">{meta.description}</p>
                  </div>
                </button>
                {open && (
                  <div className="border-t border-slate-200">
                    <BlockForm
                      block={b}
                      override={overrides[b.id] ?? {}}
                      onPatch={(patch) => onPatchOverride(b.id, patch)}
                      context="appraisal"
                    />
                  </div>
                )}
              </div>
            )
          }

          // Auto-filled o static → tarjeta read-only
          const isStatic = cat === 'static'
          return (
            <div
              key={b.id}
              className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5"
            >
              {isStatic
                ? <Lock className="mt-1 h-4 w-4 shrink-0 text-slate-400" />
                : <Info className="mt-1 h-4 w-4 shrink-0 text-slate-400" />}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-700">{meta.label}</p>
                <p className="text-xs text-slate-500">{meta.description}</p>
                <p className="mt-1 text-[11px] italic text-slate-400">
                  {isStatic ? 'Definido en el template (no se edita acá).' : autoFillNote(b)}
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Variante "empezar de cero": el usuario elige qué bloques usar
// ─────────────────────────────────────────────────────────────

function FromScratchBlocks({
  customBlocks,
  onToggle,
  onPatch,
}: {
  customBlocks: CustomBlock[]
  onToggle: (type: AppraisalBlockType) => void
  onPatch: (type: AppraisalBlockType, patch: Record<string, unknown>) => void
}) {
  const includedTypes = useMemo(() => new Set(customBlocks.map(b => b.type)), [customBlocks])
  const [expanded, setExpanded] = useState<Set<AppraisalBlockType>>(new Set())

  function toggleExpanded(t: AppraisalBlockType) {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(t) ? next.delete(t) : next.add(t)
      return next
    })
  }

  function getData(t: AppraisalBlockType): Record<string, unknown> {
    return customBlocks.find(b => b.type === t)?.data ?? {}
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">
        Elegí los bloques que querés incluir en esta tasación. Podés tildar los que necesites y
        completar su contenido acá mismo, o ajustarlos después en el editor.
      </div>

      <div className="space-y-2">
        {APPRAISAL_BLOCK_TYPES.map(type => {
          const meta = getBlockMeta(type)
          const included = includedTypes.has(type)
          const isOpen = expanded.has(type)
          const autoNote = AUTO_FILL_HINT[type]
          const syntheticBlock: TemplateBlock = {
            id: `custom-${type}`,
            type,
            binding_mode: 'tasacion',
            include_in_pdf: true,
            sort_order: 0,
            data: getData(type),
          }
          return (
            <div
              key={type}
              className={`rounded-lg border ${
                included ? 'border-[#ff007c]/40 bg-[#ff007c]/[0.03]' : 'border-slate-200'
              }`}
            >
              <div className="flex items-start gap-3 px-3 py-2.5">
                <input
                  type="checkbox"
                  checked={included}
                  onChange={() => onToggle(type)}
                  className="mt-1 h-4 w-4 cursor-pointer accent-[#ff007c]"
                  aria-label={`Incluir bloque ${meta.label}`}
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!included) onToggle(type)
                    toggleExpanded(type)
                  }}
                  className="flex flex-1 items-start justify-between gap-2 text-left"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-800">{meta.label}</p>
                    <p className="text-xs text-slate-500">{meta.description}</p>
                    {included && autoNote && (
                      <p className="mt-1 text-[11px] italic text-slate-400">{autoNote}</p>
                    )}
                  </div>
                  {included && (
                    isOpen
                      ? <ChevronDown className="mt-1 h-4 w-4 shrink-0 text-slate-400" />
                      : <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-slate-400" />
                  )}
                </button>
              </div>
              {included && isOpen && (
                <div className="border-t border-slate-200">
                  <BlockForm
                    block={syntheticBlock}
                    override={{}}
                    onPatch={patch => onPatch(type, patch)}
                    context="appraisal"
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>

      {includedTypes.size === 0 && (
        <p className="rounded-lg border border-dashed border-slate-200 px-4 py-3 text-center text-xs text-slate-400">
          Aún no elegiste ningún bloque. Podés continuar igual y agregarlos después en el editor.
        </p>
      )}
    </div>
  )
}
