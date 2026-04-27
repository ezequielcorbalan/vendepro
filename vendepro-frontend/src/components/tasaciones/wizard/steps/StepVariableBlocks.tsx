'use client'
import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { getTemplate } from '../../shared/api'
import { BlockList } from '../../editor/BlockList'
import type { TemplateBlock, BlockOverrides, AppraisalBlockType } from '../../renderer/types'

interface Props {
  templateId: string | null
  overrides: BlockOverrides
  onPatchOverride: (blockId: string, patch: Record<string, unknown>) => void
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

export function StepVariableBlocks({ templateId, overrides, onPatchOverride }: Props) {
  const [blocks, setBlocks] = useState<TemplateBlock[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!templateId) {
      setBlocks([])
      return
    }
    setBlocks(null)
    setError(null)
    getTemplate(templateId)
      .then(t => {
        const all: TemplateBlock[] = (t?.blocks ?? []) as TemplateBlock[]
        setBlocks(all.filter(isVariableBlock).sort((a, b) => a.sort_order - b.sort_order))
      })
      .catch(e => setError(e?.message ?? 'No se pudo cargar el template'))
  }, [templateId])

  if (!templateId) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
        Volvé al paso 1 y elegí un template para continuar.
      </div>
    )
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
