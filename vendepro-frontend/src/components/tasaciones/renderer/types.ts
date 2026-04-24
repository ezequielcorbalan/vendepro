// TIPOS SINCRONIZADOS MANUALMENTE con vendepro-backend/packages/core/src/domain.
// Si cambia el backend (AppraisalBlockType, BindingMode, TemplateBlock shape),
// actualizar este archivo. Los tests de hydrate-blocks validan el contrato.

export type BindingMode = 'system' | 'org-static' | 'org-variable' | 'tasacion' | 'default-override'

export const APPRAISAL_BLOCK_TYPES = [
  'cover', 'proposal_commercial', 'services_grid', 'market_stats', 'funnel_chart',
  'methodology', 'notary_charts', 'property_data', 'swot', 'zone_map',
  'comparables_list', 'price_projection', 'work_conditions',
  'video_gallery', 'extra_media', 'cta_whatsapp', 'agent_contact_card',
] as const

export type AppraisalBlockType = typeof APPRAISAL_BLOCK_TYPES[number]

export const WEB_ONLY_TYPES = new Set<AppraisalBlockType>([
  'video_gallery', 'extra_media', 'cta_whatsapp', 'agent_contact_card',
])

export const PAGE_BREAK_BEFORE = new Set<AppraisalBlockType>([
  'proposal_commercial', 'property_data', 'comparables_list', 'price_projection', 'work_conditions',
])

export interface TemplateBlock {
  id: string
  type: AppraisalBlockType
  binding_mode: BindingMode
  include_in_pdf: boolean
  sort_order: number
  data: Record<string, unknown>
}

export interface AppraisalComparable {
  id: string
  appraisal_id: string
  zonaprop_url: string | null
  address: string | null
  total_area: number | null
  covered_area: number | null
  price: number | null
  usd_per_m2: number | null
  sort_order: number
}

export interface AppraisalContext {
  id: string
  property_address: string
  neighborhood: string | null
  city: string | null
  property_type: string | null
  covered_area: number | null
  total_area: number | null
  semi_area: number | null
  weighted_area: number | null
  swot: {
    strengths: string | null
    weaknesses: string | null
    opportunities: string | null
    threats: string | null
  } | null
  prices: {
    suggested: number | null
    test: number | null
    expected_close: number | null
    usd_per_m2: number | null
  } | null
  comparables: AppraisalComparable[]
  agent: {
    name: string
    phone: string | null
    email: string | null
    avatar_url: string | null
  } | null
  org: {
    name: string
    logo_url: string | null
    brand_color: string | null
    brand_accent_color: string | null
  } | null
}

export type ResolvedVars = Record<string, { value: string; type: string }>
export type BlockOverrides = Record<string, Record<string, unknown>>

export interface HydratedBlock extends TemplateBlock {
  resolved_data: Record<string, unknown> & {
    vars_resolved?: Record<string, { value: string; type: string }>
  }
}

export type RenderMode = 'web' | 'print'
