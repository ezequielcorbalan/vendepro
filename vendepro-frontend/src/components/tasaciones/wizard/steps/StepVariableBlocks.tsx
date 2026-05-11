'use client'
import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, Loader2 } from 'lucide-react'
import { getTemplate } from '../../shared/api'
import { BlockList } from '../../editor/BlockList'
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

function isVariableBlock(b: TemplateBlock): boolean {
  if (b.binding_mode !== 'tasacion') return false
  if (AUTO_RESOLVED_TYPES.has(b.type)) return false
  const src = (b.data as any)?.source
  if (typeof src === 'string' && src.startsWith('appraisal.')) return false
  return true
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

  useEffect(() => {
    setBlocks(null)
    setError(null)
    getTemplate(templateId)
      .then(t => {
        const all: TemplateBlock[] = (t?.blocks ?? []) as TemplateBlock[]
        setBlocks(all.filter(isVariableBlock).sort((a, b) => a.sort_order - b.sort_order))
      })
      .catch(e => setError(e?.message ?? 'No se pudo cargar el template'))
  }, [templateId])

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
        Este template no requiere completar bloques variables. Continuá al siguiente paso.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">
        Completá los bloques que se llenan por separado en cada tasación (mapas, imágenes, datos
        propios). Lo que no llenes acá lo podés terminar después en el editor.
      </div>
      <BlockList
        blocks={blocks}
        overrides={overrides}
        onPatchOverride={onPatchOverride}
        context="appraisal"
      />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Variante "empezar de cero": el usuario elige qué bloques usar
// ─────────────────────────────────────────────────────────────

// Estos bloques se completan automáticamente con datos del paso "FODA + Precios"
// o "Competencia". Igual los mostramos como opt-in para que aparezcan en el informe.
const AUTO_FILLED_NOTE: Record<string, string> = {
  swot: 'Se completa con los datos del paso "FODA + Precios".',
  price_projection: 'Se completa con los datos del paso "FODA + Precios".',
  property_data: 'Se completa con los datos del paso "Propiedad".',
  comparables_list: 'Se completa con los datos del paso "Competencia".',
}

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
          const autoNote = AUTO_FILLED_NOTE[type]
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
