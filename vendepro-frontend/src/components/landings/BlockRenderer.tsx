'use client'
import type { Block } from '@/lib/landings/types'
import { BLOCK_COMPONENTS, BLOCK_LABELS } from './blocks'

interface Props {
  blocks: Block[]
  mode?: 'public' | 'editor'
  selectedBlockId?: string | null
  onSelect?: (blockId: string) => void
  onFormSubmit?: (values: Record<string, string>) => Promise<void>
}

export default function BlockRenderer({ blocks, mode = 'public', selectedBlockId, onSelect, onFormSubmit }: Props) {
  const visible = mode === 'public' ? blocks.filter(b => b.visible) : blocks

  return (
    <div className="w-full" data-mode={mode}>
      {visible.map((block) => {
        const Component = BLOCK_COMPONENTS[block.type]
        const isSelected = selectedBlockId === block.id
        const extraProps = block.type === 'lead-form' ? { onSubmit: onFormSubmit } : {}

        if (mode === 'public') {
          return block.visible ? <div key={block.id}><Component data={block.data} mode="public" {...extraProps} /></div> : null
        }

        // Editor mode: wrap with selection overlay + click handler
        return (
          <div
            key={block.id}
            className={`relative group transition-colors ${!block.visible ? 'opacity-50' : ''} ${isSelected ? 'ring-2 ring-[#ff007c] ring-offset-2' : 'hover:ring-2 hover:ring-[#ff007c]/30'}`}
            onClick={(e) => { e.stopPropagation(); onSelect?.(block.id) }}
            role="button"
            tabIndex={0}
            aria-label={`Bloque ${BLOCK_LABELS[block.type]}`}
          >
            {isSelected && (
              <span className="absolute top-2 right-2 z-20 bg-[#ff007c] text-white text-[10px] font-semibold px-2 py-1 rounded-md tracking-wider uppercase">
                {BLOCK_LABELS[block.type]} · editando
              </span>
            )}
            <Component data={block.data} mode="editor" {...extraProps} />
          </div>
        )
      })}
    </div>
  )
}
