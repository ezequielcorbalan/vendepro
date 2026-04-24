'use client'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Plus, GripVertical, Loader2, CheckCircle2 } from 'lucide-react'
import { getTemplate, updateTemplate, duplicateTemplate } from '../shared/api'
import { TemplateRenderer } from '../renderer/TemplateRenderer'
import { BlockAdminForm } from './BlockAdminForm'
import { MOCK_APPRAISAL } from './MOCK_APPRAISAL'
import type { TemplateBlock, AppraisalBlockType } from '../renderer/types'
import { APPRAISAL_BLOCK_TYPES, WEB_ONLY_TYPES } from '../renderer/types'

const DEBOUNCE_MS = 2000

function SortableBlock({ block, isReadOnly, children }: { block: TemplateBlock; isReadOnly?: boolean; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: block.id, disabled: isReadOnly })
  const style = { transform: CSS.Transform.toString(transform), transition }
  return (
    <div ref={setNodeRef} style={style} className="rounded border border-slate-200 bg-white">
      <div className="flex items-center gap-2 px-3 py-2">
        {!isReadOnly && (
          <button {...attributes} {...listeners} className="cursor-grab text-slate-400">
            <GripVertical className="h-4 w-4" />
          </button>
        )}
        <span className="text-sm font-medium">{block.type.replace(/_/g, ' ')}</span>
      </div>
      {children}
    </div>
  )
}

export function TemplateEditor({ templateId }: { templateId: string }) {
  const router = useRouter()
  const [template, setTemplate] = useState<any>(null)
  const [blocks, setBlocks] = useState<TemplateBlock[]>([])
  const [dirty, setDirty] = useState(false)
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [adding, setAdding] = useState(false)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const blocksRef = useRef(blocks)
  const isSystemRef = useRef(false)
  const pointerSensor = useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  const sensors = useSensors(pointerSensor)

  useEffect(() => {
    getTemplate(templateId).then(t => {
      setTemplate(t)
      setBlocks(t.blocks ?? [])
      isSystemRef.current = !!t.is_system
    })
  }, [templateId])

  useEffect(() => { blocksRef.current = blocks }, [blocks])

  useEffect(() => {
    if (!dirty) return
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(async () => {
      setStatus('saving')
      try {
        await updateTemplate(templateId, { blocks: blocksRef.current })
        setStatus('saved')
        setDirty(false)
      } catch (e: any) {
        setStatus('error')
      }
    }, DEBOUNCE_MS)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [dirty, templateId])

  const handleDragEnd = (e: any) => {
    if (isSystemRef.current) return
    const { active, over } = e
    if (!over || active.id === over.id) return
    const oldIdx = blocks.findIndex(b => b.id === active.id)
    const newIdx = blocks.findIndex(b => b.id === over.id)
    const reordered = arrayMove(blocks, oldIdx, newIdx).map((b, i) => ({ ...b, sort_order: i }))
    setBlocks(reordered); setDirty(true)
  }

  const updateBlock = (id: string, patch: Partial<TemplateBlock>) => {
    setBlocks(blocks.map(b => b.id === id ? { ...b, ...patch } : b)); setDirty(true)
  }
  const updateBlockData = (id: string, patch: Record<string, unknown>) => {
    setBlocks(blocks.map(b => b.id === id ? { ...b, data: { ...b.data, ...patch } } : b)); setDirty(true)
  }
  const removeBlock = (id: string) => { setBlocks(blocks.filter(b => b.id !== id)); setDirty(true) }
  const addBlock = (type: AppraisalBlockType) => {
    const id = `b-${Date.now()}`
    const include_in_pdf = !WEB_ONLY_TYPES.has(type)
    setBlocks([...blocks, { id, type, binding_mode: 'tasacion', include_in_pdf, sort_order: blocks.length, data: {} }])
    setDirty(true); setAdding(false)
  }

  if (!template) return <div className="p-12 text-center text-slate-400">Cargando template...</div>

  const isSystem = !!template.is_system

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
        <h1 className="text-sm font-semibold">{template.name}</h1>
        <div className="flex items-center gap-3 text-xs">
          {status === 'saving' && <span className="flex items-center gap-1 text-slate-500"><Loader2 className="h-3 w-3 animate-spin" /> Guardando...</span>}
          {status === 'saved' && <span className="flex items-center gap-1 text-emerald-600"><CheckCircle2 className="h-3 w-3" /> Guardado</span>}
        </div>
      </header>

      {isSystem && (
        <div className="flex items-center gap-4 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <span>Template del sistema (solo lectura).</span>
          <button
            onClick={async () => {
              try {
                const { id: newId } = await duplicateTemplate(templateId, { new_name: `${template.name} (copia)` })
                router.push(`/configuracion/tasacion/templates/${newId}`)
              } catch (e: any) {
                alert(e?.message ?? 'Error al duplicar')
              }
            }}
            className="rounded bg-amber-200 px-3 py-1 text-xs font-semibold hover:bg-amber-300"
          >
            Duplicar para editar
          </button>
          <button onClick={() => router.push('/configuracion/tasacion')} className="ml-auto underline">Volver</button>
        </div>
      )}

      <div className="bg-rose-50 px-4 py-2 text-xs text-rose-800">
        Cambios afectan tasaciones nuevas. Las existentes ven banner con opción de actualizar.
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2">
        <div className="border-r border-slate-200 bg-white p-6">
          <div className="mb-4 flex justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Bloques</h2>
            {!isSystem && <button onClick={() => setAdding(true)} className="flex items-center gap-1 rounded border border-slate-300 px-2 py-1 text-xs"><Plus className="h-3 w-3" /> Agregar</button>}
          </div>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={blocks.map(b => b.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-2">
                {blocks.map(b => (
                  <SortableBlock key={b.id} block={b} isReadOnly={isSystem}>
                    {!isSystem && (
                      <BlockAdminForm
                        block={b}
                        onPatchBlock={p => updateBlock(b.id, p)}
                        onPatchData={p => updateBlockData(b.id, p)}
                        onRemove={() => removeBlock(b.id)}
                      />
                    )}
                  </SortableBlock>
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>
        <div className="hidden lg:block">
          <div className="sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto">
            <TemplateRenderer snapshot={blocks} appraisal={MOCK_APPRAISAL} mode="web" />
          </div>
        </div>
      </div>

      {adding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-sm rounded-lg bg-white p-6">
            <h3 className="text-lg font-semibold">Agregar bloque</h3>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {APPRAISAL_BLOCK_TYPES.map(t => (
                <button key={t} onClick={() => addBlock(t)} className="rounded border border-slate-300 px-2 py-2 text-xs hover:border-[#ff007c]">
                  {t.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
            <button onClick={() => setAdding(false)} className="mt-4 rounded px-4 py-2 text-sm">Cancelar</button>
          </div>
        </div>
      )}
    </div>
  )
}
