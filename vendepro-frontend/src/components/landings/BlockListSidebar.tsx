'use client'
import { useState } from 'react'
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { arrayMove, SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Plus, Eye, EyeOff, Trash2 } from 'lucide-react'
import type { Block, BlockType } from '@/lib/landings/types'
import { BLOCK_LABELS } from './blocks'

const AVAILABLE_BLOCK_TYPES: Array<{ type: BlockType; label: string; seedData: any }> = [
  { type: 'hero-split', label: 'Hero dividido', seedData: { title: 'Título', media_url: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=1200', media_side: 'right', accent_color: 'pink' } },
  { type: 'features-grid', label: 'Grid de features', seedData: { columns: 3, items: [{ icon: 'Star', title: 'Feature 1', text: 'Descripción' }, { icon: 'Star', title: 'Feature 2', text: 'Descripción' }, { icon: 'Star', title: 'Feature 3', text: 'Descripción' }] } },
  { type: 'amenities-chips', label: 'Amenities', seedData: { chips: [{ emoji: '✨', label: 'Amenity 1' }, { emoji: '✨', label: 'Amenity 2' }, { emoji: '✨', label: 'Amenity 3' }] } },
  { type: 'gallery', label: 'Galería', seedData: { layout: 'grid', images: [{ url: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800', source: 'external' }] } },
  { type: 'benefits-list', label: 'Beneficios', seedData: { items: [{ title: 'Beneficio 1' }, { title: 'Beneficio 2' }] } },
]

interface Props {
  blocks: Block[]
  selectedId: string | null
  onSelect: (id: string) => void
  onReorder: (ordered: Block[]) => void
  onRemove: (id: string) => Promise<void>
  onToggleVisibility: (id: string, visible: boolean) => void
  onAdd: (block: Omit<Block, 'id'>) => Promise<void>
}

export default function BlockListSidebar({ blocks, selectedId, onSelect, onReorder, onRemove, onToggleVisibility, onAdd }: Props) {
  const [showAdd, setShowAdd] = useState(false)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const oldIndex = blocks.findIndex(b => b.id === active.id)
    const newIndex = blocks.findIndex(b => b.id === over.id)
    onReorder(arrayMove(blocks, oldIndex, newIndex))
  }

  return (
    <aside className="bg-white border-r border-gray-200 flex flex-col overflow-hidden">
      <div className="p-3 border-b border-gray-200">
        <h2 className="text-xs uppercase tracking-wider font-semibold text-gray-500">Bloques ({blocks.length})</h2>
      </div>
      <div className="flex-1 overflow-auto p-2 space-y-1">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={blocks.map(b => b.id)} strategy={verticalListSortingStrategy}>
            {blocks.map(b => (
              <SortableBlockRow key={b.id} block={b}
                selected={selectedId === b.id}
                onSelect={() => onSelect(b.id)}
                onRemove={() => onRemove(b.id)}
                onToggleVisibility={() => onToggleVisibility(b.id, !b.visible)}
              />
            ))}
          </SortableContext>
        </DndContext>

        <button onClick={() => setShowAdd(v => !v)}
          className="w-full text-sm text-gray-500 hover:text-[#ff007c] border border-dashed border-gray-300 rounded-lg py-2 mt-2 flex items-center justify-center gap-1.5">
          <Plus className="w-4 h-4" /> Agregar bloque
        </button>

        {showAdd && (
          <div className="border border-gray-200 rounded-xl p-2 bg-gray-50 space-y-1">
            {AVAILABLE_BLOCK_TYPES.map(t => (
              <button key={t.type} onClick={async () => {
                await onAdd({ type: t.type, visible: true, data: t.seedData })
                setShowAdd(false)
              }} className="w-full text-left text-sm px-3 py-2 rounded-lg hover:bg-white">{t.label}</button>
            ))}
          </div>
        )}
      </div>
    </aside>
  )
}

function SortableBlockRow({ block, selected, onSelect, onRemove, onToggleVisibility }: {
  block: Block; selected: boolean; onSelect: () => void; onRemove: () => void; onToggleVisibility: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }
  const isRequired = block.type === 'lead-form'

  return (
    <div ref={setNodeRef} style={style}
      className={`group flex items-center gap-1 px-2 py-1.5 rounded-lg text-sm cursor-pointer ${selected ? 'bg-[#ff007c]/10 ring-1 ring-[#ff007c]/40' : 'hover:bg-gray-100'}`}
      onClick={onSelect}>
      <button {...attributes} {...listeners} className="text-gray-400 cursor-grab active:cursor-grabbing" aria-label="Reordenar" onClick={e => e.stopPropagation()}>
        <GripVertical className="w-3.5 h-3.5" />
      </button>
      <span className={`flex-1 truncate ${block.visible ? 'text-gray-800' : 'text-gray-400'}`}>{BLOCK_LABELS[block.type]}</span>
      {isRequired && <span className="text-[10px] text-[#ff007c]" title="Requerido">◆</span>}
      <button onClick={(e) => { e.stopPropagation(); onToggleVisibility() }} className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-gray-700" title={block.visible ? 'Ocultar' : 'Mostrar'}>
        {block.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
      </button>
      {!isRequired && (
        <button onClick={(e) => { e.stopPropagation(); if (confirm('¿Eliminar este bloque?')) onRemove() }}
          className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-600" title="Eliminar">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  )
}
