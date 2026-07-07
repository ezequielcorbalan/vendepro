'use client'
import type { TemplateBlock, BindingMode } from '../renderer/types'
import { ProposalCommercialForm } from './block-forms/ProposalCommercialForm'
import { ServicesGridForm } from './block-forms/ServicesGridForm'
import { MarketStatsForm } from './block-forms/MarketStatsForm'
import { FunnelChartForm } from './block-forms/FunnelChartForm'
import { MethodologyForm } from './block-forms/MethodologyForm'
import { NotaryChartsForm } from './block-forms/NotaryChartsForm'
import { ZoneMapForm } from './block-forms/ZoneMapForm'
import { ComparablesListForm } from './block-forms/ComparablesListForm'
import { WorkConditionsForm } from './block-forms/WorkConditionsForm'
import { VideoGalleryForm } from './block-forms/VideoGalleryForm'
import { ExtraMediaForm } from './block-forms/ExtraMediaForm'
import { CtaWhatsappForm } from './block-forms/CtaWhatsappForm'
import { AgentContactCardForm } from './block-forms/AgentContactCardForm'
import { CoverForm } from './block-forms/CoverForm'

interface Props {
  block: TemplateBlock
  override: Record<string, unknown>
  onPatch: (patch: Record<string, unknown>) => void
  context: 'appraisal' | 'template'
  /** true = se usa dentro del popover angosto del canvas (fuerza layouts de una columna). */
  compact?: boolean
}

const TASACION_EDITABLE: Set<BindingMode> = new Set(['tasacion', 'default-override'])

export function BlockForm({ block, override, onPatch, context, compact }: Props) {
  const isLockedInTemplate = context === 'template' && !TASACION_EDITABLE.has(block.binding_mode)
  if (isLockedInTemplate) {
    return (
      <div className="rounded border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">
        Este bloque se configura desde Configuración → Tasación → Templates.
      </div>
    )
  }

  const isLockedInAppraisal = context === 'appraisal' && !TASACION_EDITABLE.has(block.binding_mode)
  const merged = { ...block.data, ...override }
  const props = { data: merged, onPatch }

  return (
    <div>
      {isLockedInAppraisal && (
        <div className="mx-3 mt-3 rounded border border-amber-200 bg-amber-50 px-2 py-1.5 text-[11px] text-amber-800">
          Este bloque viene del template. Los cambios acá solo aplican a esta tasación (no afectan al template).
        </div>
      )}
      {(() => {
        switch (block.type) {
          case 'cover': return <CoverForm {...props} />
          case 'proposal_commercial': return <ProposalCommercialForm {...props} />
          case 'services_grid': return <ServicesGridForm {...props} />
          case 'market_stats': return <MarketStatsForm {...props} />
          case 'funnel_chart': return <FunnelChartForm {...props} />
          case 'methodology': return <MethodologyForm {...props} />
          case 'notary_charts': return <NotaryChartsForm {...props} compact={compact} />
          case 'zone_map': return <ZoneMapForm {...props} />
          case 'comparables_list': return <ComparablesListForm {...props} />
          case 'price_projection': return <div className="p-3 text-xs text-slate-500">Se completa con los precios del paso "FODA + Precios".</div>
          case 'work_conditions': return <WorkConditionsForm {...props} />
          case 'video_gallery': return <VideoGalleryForm {...props} />
          case 'extra_media': return <ExtraMediaForm {...props} />
          case 'cta_whatsapp': return <CtaWhatsappForm {...props} />
          case 'agent_contact_card': return <AgentContactCardForm {...props} />
          case 'swot':
          case 'property_data':
            return <div className="p-3 text-xs text-slate-500">Se completa con los datos de la propiedad / FODA en el panel de arriba.</div>
          default: return null
        }
      })()}
    </div>
  )
}
