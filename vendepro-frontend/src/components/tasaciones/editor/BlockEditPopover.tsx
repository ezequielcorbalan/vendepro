'use client'
import { X } from 'lucide-react'
import type { TemplateBlock } from '../renderer/types'
import { getBlockMeta } from '../renderer/block-catalog'
import { BlockForm } from './BlockForm'
import { Button } from '@/components/ui/Button'

interface Props {
  block: TemplateBlock
  override: Record<string, unknown>
  onPatch: (patch: Record<string, unknown>) => void
  onClose: () => void
}

export function BlockEditPopover({ block, override, onPatch, onClose }: Props) {
  return (
    <div className="w-80 rounded-card border border-gray-200 bg-white shadow-pop" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center justify-between border-b border-gray-100 px-3 py-2">
        <span className="text-xs font-semibold text-gray-700">{getBlockMeta(block.type).label}</span>
        <Button variant="ghost" size="icon" onClick={onClose} className="rounded p-0.5 text-gray-400 hover:text-gray-700" aria-label="Cerrar edición">
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="max-h-[60vh] overflow-y-auto">
        <BlockForm block={block} override={override} onPatch={onPatch} context="appraisal" compact />
      </div>
    </div>
  )
}
