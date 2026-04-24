'use client'
import { useState } from 'react'
import { ChevronRight, ChevronDown, Lock } from 'lucide-react'
import type { TemplateBlock } from '../renderer/types'
import { BlockForm } from './BlockForm'

interface Props {
  blocks: TemplateBlock[]
  overrides: Record<string, Record<string, unknown>>
  onPatchOverride: (blockId: string, patch: Record<string, unknown>) => void
  context: 'appraisal' | 'template'
}

export function BlockList({ blocks, overrides, onPatchOverride, context }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
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
          <div key={b.id} className="rounded border border-slate-200">
            <button onClick={() => toggle(b.id)} className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-slate-50">
              <span className="flex items-center gap-2">
                {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                {isLocked && <Lock className="h-3 w-3 text-slate-400" />}
                {b.type.replace(/_/g, ' ')}
              </span>
              <span className="text-xs text-slate-400">{b.binding_mode}</span>
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
