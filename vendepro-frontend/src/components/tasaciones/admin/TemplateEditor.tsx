'use client'
import { useToast } from '@/components/ui/Toast'
import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Plus, GripVertical, Loader2, CheckCircle2, Save, AlertCircle, ArrowLeft } from 'lucide-react'
import { getTemplate, updateTemplate, duplicateTemplate } from '../shared/api'
import { apiFetch } from '@/lib/api'
import { TemplateRenderer } from '../renderer/TemplateRenderer'
import { BlockAdminForm } from './BlockAdminForm'
import { MOCK_APPRAISAL } from './MOCK_APPRAISAL'
import type { TemplateBlock, AppraisalBlockType } from '../renderer/types'
import { APPRAISAL_BLOCK_TYPES, WEB_ONLY_TYPES } from '../renderer/types'
import { getBlockMeta } from '../renderer/block-catalog'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { Heading, Text } from '@/components/ui/Typography'

const DEBOUNCE_MS = 2000

function SortableBlock({ block, isReadOnly, children }: { block: TemplateBlock; isReadOnly?: boolean; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: block.id, disabled: isReadOnly })
  const style = { transform: CSS.Transform.toString(transform), transition }
  return (
    <div ref={setNodeRef} style={style} className="rounded border border-gray-200 bg-white">
      <div className="flex items-center gap-2 px-3 py-2">
        {!isReadOnly && (
          <button {...attributes} {...listeners} className="cursor-grab text-gray-400">
            <GripVertical className="h-4 w-4" />
          </button>
        )}
        <span className="text-sm font-medium">{getBlockMeta(block.type).label}</span>
      </div>
      {children}
    </div>
  )
}

export function TemplateEditor({ templateId }: { templateId: string }) {
  const { toast } = useToast()
  const router = useRouter()
  const [template, setTemplate] = useState<any>(null)
  const [orgBrand, setOrgBrand] = useState<{ name?: string; logo_url?: string | null; brand_color?: string | null; brand_accent_color?: string | null } | null>(null)
  const [blocks, setBlocks] = useState<TemplateBlock[]>([])
  const [dirty, setDirty] = useState(false)
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
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
    apiFetch('admin', '/org-settings')
      .then(r => r.json() as Promise<any>)
      .then(d => setOrgBrand({
        name: d.name,
        logo_url: d.logo_url,
        brand_color: d.brand_color,
        brand_accent_color: d.brand_accent_color,
      }))
      .catch(() => { /* silencioso: cae al MOCK */ })
  }, [templateId])

  useEffect(() => { blocksRef.current = blocks }, [blocks])

  const saveNow = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    setStatus('saving')
    setErrorMsg(null)
    try {
      await updateTemplate(templateId, { blocks: blocksRef.current })
      setStatus('saved')
      setDirty(false)
    } catch (e: any) {
      setStatus('error')
      setErrorMsg(e?.message ?? 'Error desconocido')
    }
  }, [templateId])

  useEffect(() => {
    if (!dirty) return
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => { saveNow() }, DEBOUNCE_MS)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [dirty, saveNow])

  // Flush pending changes when the user leaves the page (close tab, navigate
  // away, switch tab/window). Avoids losing the last 2s of edits.
  useEffect(() => {
    const dirtyRef = { current: dirty }
    dirtyRef.current = dirty
    const flush = () => { if (dirtyRef.current) saveNow() }
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (dirtyRef.current) {
        flush()
        e.preventDefault()
        e.returnValue = ''
      }
    }
    const onVisibility = () => { if (document.visibilityState === 'hidden') flush() }
    window.addEventListener('blur', flush)
    window.addEventListener('beforeunload', onBeforeUnload)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('blur', flush)
      window.removeEventListener('beforeunload', onBeforeUnload)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [dirty, saveNow])

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
    setBlocks(prev => prev.map(b => b.id === id ? { ...b, ...patch } : b)); setDirty(true)
  }
  const updateBlockData = (id: string, patch: Record<string, unknown>) => {
    setBlocks(prev => prev.map(b => b.id === id ? { ...b, data: { ...b.data, ...patch } } : b)); setDirty(true)
  }
  const removeBlock = (id: string) => { setBlocks(prev => prev.filter(b => b.id !== id)); setDirty(true) }
  const addBlock = (type: AppraisalBlockType) => {
    const id = `b-${Date.now()}`
    const include_in_pdf = !WEB_ONLY_TYPES.has(type)
    setBlocks(prev => [...prev, { id, type, binding_mode: 'tasacion', include_in_pdf, sort_order: prev.length, data: {} }])
    setDirty(true); setAdding(false)
  }

  if (!template) return <div className="p-12 text-center text-gray-400">Cargando template...</div>

  const isSystem = !!template.is_system

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3">
        <div className="flex items-center gap-3 min-w-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/configuracion/tasacion')}
            aria-label="Volver a Configuración · Tasaciones"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Heading level={4} as="h1" className="truncate">{template.name}</Heading>
        </div>
        <div className="flex items-center gap-3 text-xs">
          {status === 'saving' && <span className="flex items-center gap-1 text-gray-500"><Loader2 className="h-3 w-3 animate-spin" /> Guardando...</span>}
          {status === 'saved' && !dirty && <span className="flex items-center gap-1 text-success"><CheckCircle2 className="h-3 w-3" /> Guardado</span>}
          {status === 'error' && (
            <span
              title={errorMsg ?? undefined}
              className="flex max-w-md items-center gap-1 truncate text-danger"
            >
              <AlertCircle className="h-3 w-3 shrink-0" /> {errorMsg ?? 'Error al guardar'}
            </span>
          )}
          {dirty && status !== 'saving' && status !== 'error' && <span className="text-gray-500">Cambios sin guardar</span>}
          {!isSystem && (
            <Button
              size="sm"
              onClick={() => saveNow()}
              loading={status === 'saving'}
              icon={<Save className="h-3 w-3" />}
            >
              Guardar cambios
            </Button>
          )}
        </div>
      </header>

      {isSystem && (
        <Alert tone="warning" className="mx-4 mt-4">
          <span className="flex flex-wrap items-center gap-3">
          <span>Template del sistema (solo lectura).</span>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              try {
                const { id: newId } = await duplicateTemplate(templateId, { new_name: `${template.name} (copia)` })
                router.push(`/configuracion/tasacion/templates/${newId}`)
              } catch (e: any) {
                toast(e?.message ?? 'Error al duplicar', 'error')
              }
            }}
          >
            Duplicar para editar
          </Button>
          <Button variant="ghost" size="sm" onClick={() => router.push('/configuracion/tasacion')}>Volver</Button>
          </span>
        </Alert>
      )}

      {/* Era una banda rosa a sangre: es un aviso, así que va como Alert. */}
      <Alert tone="info" className="mx-4 mt-4">
        Los cambios afectan a las tasaciones nuevas. Las existentes ven un banner con la opción de actualizar.
      </Alert>

      <div className="grid grid-cols-1 lg:grid-cols-2">
        <div className="border-r border-gray-200 bg-white p-6">
          <div className="mb-4 flex justify-between">
            <Text as="h2" size="sm" weight="semibold" className="uppercase tracking-wide text-gray-600">Bloques</Text>
            {!isSystem && (
              <Button variant="outline" size="sm" onClick={() => setAdding(true)} icon={<Plus className="h-3 w-3" />}>
                Agregar
              </Button>
            )}
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
            <TemplateRenderer
              snapshot={blocks}
              appraisal={orgBrand ? { ...MOCK_APPRAISAL, org: { ...MOCK_APPRAISAL.org, ...orgBrand } as any } : MOCK_APPRAISAL}
              mode="web"
              editing
            />
          </div>
        </div>
      </div>

      {adding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-card bg-white p-6">
            <h3 className="text-lg font-semibold">Agregar bloque</h3>
            <p className="mt-1 text-xs text-gray-500">Elegí qué información querés sumar a la tasación.</p>
            <div className="mt-4 grid grid-cols-1 gap-2 overflow-y-auto sm:grid-cols-2">
              {APPRAISAL_BLOCK_TYPES.map(t => {
                const meta = getBlockMeta(t)
                return (
                  <button
                    key={t}
                    onClick={() => addBlock(t)}
                    className="rounded-control border border-gray-300 px-3 py-2 text-left hover:border-primary hover:bg-primary/5"
                  >
                    <div className="text-sm font-medium text-ink">{meta.label}</div>
                    <div className="mt-0.5 text-xs leading-snug text-gray-500">{meta.description}</div>
                  </button>
                )
              })}
            </div>
            <button onClick={() => setAdding(false)} className="mt-4 self-end rounded px-4 py-2 text-sm text-gray-600 hover:bg-gray-100">Cancelar</button>
          </div>
        </div>
      )}
    </div>
  )
}
