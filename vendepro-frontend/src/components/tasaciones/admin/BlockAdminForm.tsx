'use client'
import type { TemplateBlock, BindingMode, AppraisalBlockType } from '../renderer/types'
import { BlockForm } from '../editor/BlockForm'

const BINDING_MODES: BindingMode[] = ['system', 'org-static', 'org-variable', 'tasacion', 'default-override']

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
  return (
    <div className="space-y-3 border-t border-slate-200 p-3">
      <div className="flex items-center gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wide text-slate-600">Binding mode</span>
          <select value={block.binding_mode} onChange={e => onPatchBlock({ binding_mode: e.target.value as BindingMode })} className="rounded border border-slate-300 px-2 py-1 text-sm">
            {BINDING_MODES.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" disabled={pdfLocked} checked={block.include_in_pdf} onChange={e => onPatchBlock({ include_in_pdf: e.target.checked })} />
          <span className={pdfLocked ? 'text-slate-400' : ''}>Incluir en PDF</span>
        </label>
        <button onClick={onRemove} className="ml-auto text-xs text-rose-500">Eliminar</button>
      </div>
      <BlockForm block={block} override={{}} onPatch={onPatchData} context="template" />
    </div>
  )
}
