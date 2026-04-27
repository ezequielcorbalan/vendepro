'use client'
import type { TemplateBlock, BindingMode, AppraisalBlockType } from '../renderer/types'
import { BlockForm } from '../editor/BlockForm'

const BINDING_MODE_OPTIONS: { value: BindingMode; label: string; hint: string }[] = [
  {
    value: 'system',
    label: 'Texto fijo del sistema',
    hint: 'Mismo contenido para todas las inmobiliarias. Lo define VendéPro.',
  },
  {
    value: 'org-static',
    label: 'Texto fijo de la inmobiliaria',
    hint: 'Texto que cargás vos una vez y se repite igual en todas las tasaciones de tu inmobiliaria.',
  },
  {
    value: 'org-variable',
    label: 'Variables de la inmobiliaria',
    hint: 'Usa valores guardados en Variables (ej: estadísticas de mercado, datos institucionales).',
  },
  {
    value: 'tasacion',
    label: 'Datos de cada tasación',
    hint: 'Se completa por separado en cada tasación que crees (ej: FODA, dirección, comparables).',
  },
  {
    value: 'default-override',
    label: 'Valor por defecto editable',
    hint: 'Trae un valor sugerido pero el asesor puede modificarlo en cada tasación.',
  },
]

const PDF_LOCKED: Set<AppraisalBlockType> = new Set([
  'cover', 'property_data', 'swot', 'price_projection',
  'video_gallery', 'extra_media', 'cta_whatsapp', 'agent_contact_card',
])

interface Props {
  block: TemplateBlock
  onPatchBlock: (patch: Partial<TemplateBlock>) => void
  onPatchData: (patch: Record<string, unknown>) => void
  onRemove: () => void
}

export function BlockAdminForm({ block, onPatchBlock, onPatchData, onRemove }: Props) {
  const pdfLocked = PDF_LOCKED.has(block.type)
  const currentMode = BINDING_MODE_OPTIONS.find(m => m.value === block.binding_mode)
  return (
    <div className="space-y-3 border-t border-slate-200 p-3">
      <div className="flex flex-wrap items-start gap-3">
        <label className="flex flex-1 flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">
            ¿De dónde sale el contenido?
          </span>
          <select
            value={block.binding_mode}
            onChange={e => onPatchBlock({ binding_mode: e.target.value as BindingMode })}
            className="rounded border border-slate-300 px-2 py-1.5 text-sm"
          >
            {BINDING_MODE_OPTIONS.map(m => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
          {currentMode && (
            <span className="mt-1 text-xs leading-snug text-slate-500">{currentMode.hint}</span>
          )}
        </label>
        <label className="flex items-center gap-2 pt-7 text-sm">
          <input
            type="checkbox"
            disabled={pdfLocked}
            checked={block.include_in_pdf}
            onChange={e => onPatchBlock({ include_in_pdf: e.target.checked })}
          />
          <span
            className={pdfLocked ? 'text-slate-400' : ''}
            title={pdfLocked ? 'Este bloque siempre se incluye en el PDF' : ''}
          >
            Incluir en PDF
          </span>
        </label>
        <button
          onClick={onRemove}
          className="ml-auto pt-7 text-xs text-rose-500 hover:text-rose-700"
        >
          Eliminar
        </button>
      </div>
      <BlockForm block={block} override={{}} onPatch={onPatchData} context="template" />
    </div>
  )
}
