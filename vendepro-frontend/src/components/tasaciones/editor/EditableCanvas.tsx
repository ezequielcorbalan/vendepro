'use client'
import { useMemo, useState } from 'react'
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  GripVertical, Trash2, Plus, Lock, AlignLeft, AlignCenter, AlignRight,
  Heading1, Heading2, Heading3, Type, Image as ImageIcon, Images, Minus, Quote, Link2, AlertTriangle,
  PaintBucket, Space,
} from 'lucide-react'
import { hydrateBlocks } from '../renderer/hydrate-blocks'
import { BlockRenderer } from '../renderer/BlockRenderer'
import { getBlockCompleteness } from '../renderer/block-completeness'
import { getBlockMeta } from '../renderer/block-catalog'
import { FREE_BLOCK_TYPES, INLINE_STRUCTURED_TYPES, WEB_ONLY_TYPES } from '../renderer/types'
import type { AppraisalBlockType, AppraisalContext, BlockOverrides, HydratedBlock, RenderMode, TemplateBlock } from '../renderer/types'
import { blockDataAttrs } from '../renderer/block-utils'
import { HeadingBlock } from '../renderer/blocks/HeadingBlock'
import { RichTextBlock } from '../renderer/blocks/RichTextBlock'
import { ImageBlock } from '../renderer/blocks/ImageBlock'
import { GalleryBlock } from '../renderer/blocks/GalleryBlock'
import { DividerBlock } from '../renderer/blocks/DividerBlock'
import { CalloutBlock } from '../renderer/blocks/CalloutBlock'
import { ButtonLinkBlock } from '../renderer/blocks/ButtonLinkBlock'
import { CoverBlock } from '../renderer/blocks/CoverBlock'
import { MethodologyBlock } from '../renderer/blocks/MethodologyBlock'
import { CtaWhatsappBlock } from '../renderer/blocks/CtaWhatsappBlock'
import { AgentContactCardBlock } from '../renderer/blocks/AgentContactCardBlock'
import { ZoneMapBlock } from '../renderer/blocks/ZoneMapBlock'
import { BlockEditPopover } from './BlockEditPopover'
import '../renderer/print.css'

interface Props {
  snapshot: TemplateBlock[]
  overrides: BlockOverrides
  appraisal: AppraisalContext
  mode: RenderMode
  onAdd: (type: AppraisalBlockType, atIndex: number) => void
  onRemove: (blockId: string) => void
  onReorder: (from: number, to: number) => void
  onPatchData: (blockId: string, patch: Record<string, unknown>) => void
  /** Persiste un patch de un bloque bloqueado del template como override puntual de esta tasación. */
  onPatchOverride: (blockId: string, patch: Record<string, unknown>) => void
  /** Abre el formulario del bloque estructurado (edición vía overrides). */
  onEditStructured?: (blockId: string) => void
}

// Paleta de elementos libres que se pueden insertar en la tasación.
const PALETTE: Array<{ type: AppraisalBlockType; icon: typeof Type; seed: Record<string, unknown> }> = [
  { type: 'heading', icon: Heading2, seed: { level: 2, align: 'left' } },
  { type: 'rich_text', icon: Type, seed: {} },
  { type: 'image', icon: ImageIcon, seed: { width: 'wide', align: 'center' } },
  { type: 'gallery', icon: Images, seed: { columns: 3, images: [] } },
  { type: 'divider', icon: Minus, seed: { style: 'line', size: 'md' } },
  { type: 'callout', icon: Quote, seed: { tone: 'accent' } },
  { type: 'button_link', icon: Link2, seed: {} },
]

export function EditableCanvas({
  snapshot, overrides, appraisal, mode, onAdd, onRemove, onReorder, onPatchData, onPatchOverride, onEditStructured,
}: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  )

  const hydrated = useMemo(
    () => hydrateBlocks({ snapshot, overrides, appraisal, resolvedVars: {}, mode }),
    [snapshot, overrides, appraisal, mode],
  )

  const brandStyle = {
    '--brand-color': appraisal.org?.brand_color ?? '#ff007c',
    '--brand-accent-color': appraisal.org?.brand_accent_color ?? '#e17a2a',
  } as React.CSSProperties

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const from = snapshot.findIndex(b => b.id === active.id)
    const to = snapshot.findIndex(b => b.id === over.id)
    if (from >= 0 && to >= 0) onReorder(from, to)
  }

  return (
    <div style={brandStyle} className="bg-white">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={snapshot.map(b => b.id)} strategy={verticalListSortingStrategy}>
          {/* Insertar al principio */}
          <InsertZone onInsert={(t) => onAdd(t, 0)} />
          {snapshot.map((block, index) => {
            const h = hydrated.find(x => x.id === block.id)
            const isFree = FREE_BLOCK_TYPES.has(block.type)
            const isInlineStructured = INLINE_STRUCTURED_TYPES.has(block.type)
            const completeness = h ? getBlockCompleteness(h, appraisal) : { complete: true, missingLabel: null }
            const backgroundColor = isFree
              ? ((block.data as any).background_color ?? null)
              : ((h?.resolved_data as any)?.background_color ?? null)
            const persistPatch = (patch: Record<string, unknown>) =>
              isFree ? onPatchData(block.id, patch) : onPatchOverride(block.id, patch)
            return (
              <div key={block.id}>
                <SortableBlock
                  block={block}
                  selected={selectedId === block.id}
                  isFree={isFree}
                  incomplete={!completeness.complete}
                  missingLabel={completeness.missingLabel}
                  backgroundColor={backgroundColor}
                  onBackgroundChange={(color) => persistPatch({ background_color: color })}
                  onSelect={() => setSelectedId(block.id)}
                  onRemove={() => onRemove(block.id)}
                  onPatchData={(patch) => onPatchData(block.id, patch)}
                  onEditStructured={!isFree ? () => setEditingId(block.id) : undefined}
                >
                  {isFree
                    ? <EditableFreeBlock block={block} onChange={(patch) => onPatchData(block.id, patch)} />
                    : isInlineStructured
                      ? (h ? <EditableStructuredBlock block={h} appraisal={appraisal} onChange={(patch) => onPatchOverride(block.id, patch)} /> : null)
                      : (h ? <BlockRenderer block={h} mode={mode} appraisal={appraisal} /> : null)}
                  {editingId === block.id && (
                    <div className="absolute right-2 top-10 z-30">
                      <BlockEditPopover
                        block={block}
                        override={overrides[block.id] ?? {}}
                        onPatch={(patch) => onPatchOverride(block.id, patch)}
                        onClose={() => setEditingId(null)}
                      />
                    </div>
                  )}
                </SortableBlock>
                {/* Insertar después de este bloque */}
                <InsertZone onInsert={(t) => onAdd(t, index + 1)} />
              </div>
            )
          })}
          {snapshot.length === 0 && (
            <div className="flex flex-col items-center justify-center px-8 py-24 text-center text-gray-400">
              <Plus className="mb-2 h-8 w-8" />
              <p className="text-sm">Agregá tu primer elemento con el botón <span className="font-medium">+</span> de arriba.</p>
            </div>
          )}
        </SortableContext>
      </DndContext>
    </div>
  )
}

function SortableBlock({
  block, selected, isFree, incomplete, missingLabel, backgroundColor, children,
  onSelect, onRemove, onPatchData, onEditStructured, onBackgroundChange,
}: {
  block: TemplateBlock
  selected: boolean
  isFree: boolean
  incomplete: boolean
  missingLabel: string | null
  backgroundColor: string | null
  children: React.ReactNode
  onSelect: () => void
  onRemove: () => void
  onPatchData: (patch: Record<string, unknown>) => void
  onEditStructured?: () => void
  onBackgroundChange: (color: string | null) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={onSelect}
      className={`group relative border-y-2 transition-colors ${
        selected ? 'border-brand-pink/70' : 'border-transparent hover:border-brand-pink/20'
      }`}
    >
      {/* Rail de controles */}
      <div className={`absolute left-1 top-1 z-20 flex items-center gap-1 transition-opacity ${selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
        <button
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
          className="cursor-grab rounded bg-white/90 p-1 text-gray-500 shadow-pop hover:text-ink active:cursor-grabbing"
          title="Arrastrar para reordenar"
          aria-label="Reordenar bloque"
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <span className="rounded bg-white/90 px-2 py-0.5 text-[10px] font-medium text-gray-500 shadow-pop">
          {getBlockMeta(block.type).label}
        </span>
        {!isFree && (
          <span className="flex items-center gap-0.5 rounded bg-white/90 px-1.5 py-0.5 text-[10px] text-gray-400 shadow-pop" title="Bloque del template">
            <Lock className="h-3 w-3" /> template
          </span>
        )}
      </div>

      <div className={`absolute right-1 top-1 z-20 flex items-center gap-1 transition-opacity ${selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
        <BackgroundColorButton value={backgroundColor} onChange={onBackgroundChange} />
        {!isFree && onEditStructured && (
          <button
            onClick={(e) => { e.stopPropagation(); onEditStructured() }}
            className="rounded bg-white/90 px-2 py-1 text-[11px] font-medium text-gray-600 shadow-pop hover:text-brand-pink"
          >
            Editar campos
          </button>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); if (confirm('¿Eliminar este bloque de la tasación?')) onRemove() }}
          className="rounded bg-white/90 p-1 text-gray-400 shadow-pop hover:text-danger"
          title="Eliminar bloque"
          aria-label="Eliminar bloque"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {/* Toolbar de opciones del bloque libre seleccionado */}
      {isFree && selected && (
        <div className="absolute left-1/2 top-1 z-20 -translate-x-1/2" onClick={(e) => e.stopPropagation()}>
          <FreeBlockToolbar block={block} onPatch={onPatchData} />
        </div>
      )}

      {incomplete && (
        <div className="flex items-center gap-1.5 bg-warning/10 px-4 py-1 text-[11px] text-warning">
          <AlertTriangle className="h-3 w-3 shrink-0" />
          No se va a publicar{missingLabel ? ` — falta ${missingLabel}.` : ' porque faltan datos.'}
        </div>
      )}

      {children}
    </div>
  )
}

function BackgroundColorButton({ value, onChange }: { value: string | null; onChange: (color: string | null) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(o => !o) }}
        className="rounded bg-white/90 p-1 text-gray-400 shadow-pop hover:text-gray-700"
        title="Color de fondo"
        aria-label="Color de fondo del bloque"
      >
        <PaintBucket className="h-4 w-4" style={value ? { color: value } : undefined} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-6 z-30 flex items-center gap-2 rounded-control border border-gray-200 bg-white p-2 shadow-pop" onClick={(e) => e.stopPropagation()}>
            <input
              type="color"
              value={value ?? '#ffffff'}
              onChange={(e) => onChange(e.target.value)}
              className="h-7 w-7 rounded border border-gray-300 p-0.5"
              aria-label="Elegir color de fondo"
            />
            {value && (
              <button onClick={() => { onChange(null); setOpen(false) }} className="text-xs text-gray-500 hover:text-danger">
                Quitar
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function FreeBlockToolbar({ block, onPatch }: { block: TemplateBlock; onPatch: (patch: Record<string, unknown>) => void }) {
  const d = block.data as any
  // Barra flotante de edición inline (el "bubble toolbar" del canvas). No hay
// equivalente en el DS y es el único uso en la app, así que vive acá con los
// tokens del DS.
// ds-todo: candidato a componente "BubbleToolbar" si un segundo editor lo pide.
const wrap = 'flex items-center gap-0.5 rounded-card border border-gray-200 bg-white px-1 py-1 shadow-pop'
  const btn = (active: boolean) => `rounded p-1 ${active ? 'bg-brand-pink/10 text-brand-pink' : 'text-gray-500 hover:bg-gray-100'}`

  switch (block.type) {
    case 'heading':
      return (
        <div className={wrap}>
          {[1, 2, 3].map(lvl => {
            const Icon = lvl === 1 ? Heading1 : lvl === 2 ? Heading2 : Heading3
            return <button key={lvl} className={btn((d.level ?? 2) === lvl)} onClick={() => onPatch({ level: lvl })} title={`Título ${lvl}`} aria-label={`Título nivel ${lvl}`} aria-pressed={(d.level ?? 2) === lvl}><Icon className="h-4 w-4" /></button>
          })}
          <span className="mx-1 h-4 w-px bg-gray-200" />
          <AlignButtons value={d.align ?? 'left'} onChange={(align) => onPatch({ align })} />
        </div>
      )
    case 'image':
      return (
        <div className={wrap}>
          {(['medium', 'wide', 'full'] as const).map(w => (
            <button key={w} className={btn((d.width ?? 'wide') === w)} onClick={() => onPatch({ width: w })} title={w}>
              <span className="px-1 text-[11px] capitalize">{w === 'medium' ? 'S' : w === 'wide' ? 'M' : 'L'}</span>
            </button>
          ))}
          <span className="mx-1 h-4 w-px bg-gray-200" />
          <AlignButtons value={d.align ?? 'center'} onChange={(align) => onPatch({ align })} />
        </div>
      )
    case 'gallery':
      return (
        <div className={wrap}>
          <span className="px-1 text-[11px] text-gray-400">Columnas</span>
          {[2, 3, 4].map(c => (
            <button key={c} className={btn((d.columns ?? 3) === c)} onClick={() => onPatch({ columns: c })} title={`${c} columnas`} aria-label={`${c} columnas`} aria-pressed={(d.columns ?? 3) === c}>
              <span className="px-1 text-[11px]">{c}</span>
            </button>
          ))}
        </div>
      )
    case 'divider':
      return (
        <div className={wrap}>
          <button className={btn((d.style ?? 'line') === 'line')} onClick={() => onPatch({ style: 'line' })} title="Línea"><Minus className="h-4 w-4" /></button>
          <button className={btn((d.style ?? 'line') === 'space')} onClick={() => onPatch({ style: 'space' })} title="Espacio"><Space className="h-4 w-4" /></button>
          <span className="mx-1 h-4 w-px bg-gray-200" />
          {(['sm', 'md', 'lg'] as const).map(s => (
            <button key={s} className={btn((d.size ?? 'md') === s)} onClick={() => onPatch({ size: s })} title={s}><span className="px-1 text-[11px] uppercase">{s}</span></button>
          ))}
        </div>
      )
    case 'callout':
      return (
        <div className={wrap}>
          <button className={btn((d.tone ?? 'accent') === 'accent')} onClick={() => onPatch({ tone: 'accent' })} title="Marca"><span className="px-1 text-[11px]">Marca</span></button>
          <button className={btn((d.tone ?? 'accent') === 'info')} onClick={() => onPatch({ tone: 'info' })} title="Neutro"><span className="px-1 text-[11px]">Neutro</span></button>
        </div>
      )
    case 'button_link':
      return (
        <div className={wrap}>
          <input
            type="url"
            aria-label="Enlace del botón"
            defaultValue={d.url ?? ''}
            onBlur={(e) => onPatch({ url: e.target.value.trim() || null })}
            placeholder="https://enlace-del-boton…"
            className="w-56 rounded px-2 py-0.5 text-xs outline-none"
          />
        </div>
      )
    default:
      return null
  }
}

function AlignButtons({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const btn = (active: boolean) => `rounded p-1 ${active ? 'bg-brand-pink/10 text-brand-pink' : 'text-gray-500 hover:bg-gray-100'}`
  return (
    <>
      <button className={btn(value === 'left')} onClick={() => onChange('left')} title="Izquierda" aria-label="Alinear a la izquierda" aria-pressed={value === 'left'}><AlignLeft className="h-4 w-4" /></button>
      <button className={btn(value === 'center')} onClick={() => onChange('center')} title="Centro" aria-label="Centrar" aria-pressed={value === 'center'}><AlignCenter className="h-4 w-4" /></button>
      <button className={btn(value === 'right')} onClick={() => onChange('right')} title="Derecha" aria-label="Alinear a la derecha" aria-pressed={value === 'right'}><AlignRight className="h-4 w-4" /></button>
    </>
  )
}

function EditableFreeBlock({ block, onChange }: { block: TemplateBlock; onChange: (patch: Record<string, unknown>) => void }) {
  const attrs = blockDataAttrs(block)
  const data = block.data as any
  const edit = { onChange }
  let content: React.ReactNode
  switch (block.type) {
    case 'heading': content = <HeadingBlock data={data} edit={edit} {...attrs} />; break
    case 'rich_text': content = <RichTextBlock data={data} edit={edit} {...attrs} />; break
    case 'image': content = <ImageBlock data={data} edit={edit} {...attrs} />; break
    case 'gallery': content = <GalleryBlock data={data} edit={edit} {...attrs} />; break
    case 'divider': content = <DividerBlock data={data} edit={edit} {...attrs} />; break
    case 'callout': content = <CalloutBlock data={data} edit={edit} {...attrs} />; break
    case 'button_link': content = <ButtonLinkBlock data={data} edit={edit} {...attrs} />; break
    default: return null
  }
  return data.background_color ? <div style={{ backgroundColor: data.background_color }}>{content}</div> : content
}

function EditableStructuredBlock({
  block, appraisal, onChange,
}: {
  block: HydratedBlock
  appraisal: AppraisalContext
  onChange: (patch: Record<string, unknown>) => void
}) {
  const attrs = blockDataAttrs(block)
  const data = block.resolved_data as any
  const edit = { onChange }
  let content: React.ReactNode
  switch (block.type) {
    case 'cover': content = <CoverBlock data={data} appraisal={appraisal} edit={edit} {...attrs} />; break
    case 'methodology': content = <MethodologyBlock data={data} edit={edit} {...attrs} />; break
    case 'cta_whatsapp': content = <CtaWhatsappBlock data={data} edit={edit} {...attrs} />; break
    case 'agent_contact_card': content = <AgentContactCardBlock data={data} appraisal={appraisal} edit={edit} {...attrs} />; break
    case 'zone_map': content = <ZoneMapBlock data={data} edit={edit} {...attrs} />; break
    default: return null
  }
  return data.background_color ? <div style={{ backgroundColor: data.background_color }}>{content}</div> : content
}

function InsertZone({ onInsert }: { onInsert: (type: AppraisalBlockType) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="group/insert relative flex h-6 items-center justify-center">
      <div className={`pointer-events-none absolute inset-x-6 top-1/2 h-px -translate-y-1/2 transition-colors ${open ? 'bg-brand-pink/30' : 'bg-transparent group-hover/insert:bg-brand-pink/30'}`} />
      <button
        onClick={() => setOpen(o => !o)}
        className={`z-10 flex h-5 w-5 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-400 shadow-pop transition-opacity hover:border-brand-pink hover:text-brand-pink ${open ? 'opacity-100' : 'opacity-0 group-hover/insert:opacity-100 focus:opacity-100'}`}
        title="Insertar elemento aquí"
        aria-label="Insertar elemento"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute top-6 z-30 flex flex-wrap gap-1 rounded-card border border-gray-200 bg-white p-2 shadow-pop">
            {PALETTE.map(({ type, icon: Icon }) => (
              <button
                key={type}
                onClick={() => { onInsert(type); setOpen(false) }}
                className="flex w-24 flex-col items-center gap-1 rounded-control px-2 py-2 text-[11px] text-gray-600 hover:bg-rose-50/50 hover:text-brand-pink"
              >
                <Icon className="h-4 w-4" />
                {getBlockMeta(type).label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export { PALETTE }
export function isWebOnly(type: AppraisalBlockType): boolean {
  return WEB_ONLY_TYPES.has(type)
}
