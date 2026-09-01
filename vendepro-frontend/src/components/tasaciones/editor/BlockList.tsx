'use client'
import { useEffect, useState } from 'react'
import { ChevronRight, ChevronDown, Lock } from 'lucide-react'
import type { TemplateBlock } from '../renderer/types'
import { getBlockMeta } from '../renderer/block-catalog'
import { BlockForm } from './BlockForm'

interface Props {
  blocks: TemplateBlock[]
  overrides: Record<string, Record<string, unknown>>
  onPatchOverride: (blockId: string, patch: Record<string, unknown>) => void
  context: 'appraisal' | 'template'
  /** Fuerza expandir un bloque (p.ej. al tocar "Editar campos" en el canvas). */
  openId?: string | null
}

export function BlockList({ blocks, overrides, onPatchOverride, context, openId }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (openId) setExpanded(prev => new Set(prev).add(openId))
  }, [openId])

  const toggle = (id: string) => {
    const next = new Set(expanded)
    next.has(id) ? next.delete(id) : next.add(id)
    setExpanded(next)
  }
  return (
    <div className="space-y-1">
      {blocks.map(b => {
        const isLocked = context === 'appraisal' && b.binding_mode !== 'tasacion' && b.binding_mode !== 'default-override'
        const open = expanded.has(b.id)
        return (
          <div key={b.id} className="rounded border border-gray-200">
            <button onClick={() => toggle(b.id)} className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-gray-50">
              <span className="flex items-center gap-2">
                {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                {isLocked && <span title="Definido en el template"><Lock className="h-3 w-3 text-gray-400" /></span>}
                <span className="font-medium">{getBlockMeta(b.type).label}</span>
              </span>
              {isLocked && <span className="text-xs text-gray-400">Solo lectura</span>}
            </button>
            {open && (
              <BlockForm
                block={b}
                override={overrides[b.id] ?? {}}
                onPatch={(patch) => onPatchOverride(b.id, patch)}
                context={context}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
