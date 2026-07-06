import { ValidationError } from '../errors/validation-error'

export const STRUCTURAL_BLOCK_TYPES = [
  'cover',
  'proposal_commercial',
  'services_grid',
  'market_stats',
  'funnel_chart',
  'methodology',
  'notary_charts',
] as const

export const DYNAMIC_BLOCK_TYPES = [
  'property_data',
  'swot',
  'zone_map',
  'comparables_list',
  'price_projection',
  'work_conditions',
] as const

export const WEB_ONLY_BLOCK_TYPES = [
  'video_gallery',
  'extra_media',
  'cta_whatsapp',
  'agent_contact_card',
] as const

/**
 * Bloques "libres" que el asesor arma a mano en cada tasación (editor WYSIWYG).
 * Contenido arbitrario, no atado a datos de la tasación ni de la org.
 * `button_link` es web-only (no se imprime en el PDF).
 */
export const FREE_BLOCK_TYPES = [
  'heading',
  'rich_text',
  'image',
  'divider',
  'callout',
  'button_link',
] as const

export const APPRAISAL_BLOCK_TYPES = [
  ...STRUCTURAL_BLOCK_TYPES,
  ...DYNAMIC_BLOCK_TYPES,
  ...WEB_ONLY_BLOCK_TYPES,
  ...FREE_BLOCK_TYPES,
] as const

export type AppraisalBlockType = typeof APPRAISAL_BLOCK_TYPES[number]

/** Types whose `include_in_pdf` cannot be changed by the user. */
export const PDF_LOCKED_TYPES = new Set<AppraisalBlockType>([
  'cover', 'property_data', 'swot', 'price_projection',
  ...WEB_ONLY_BLOCK_TYPES,
  'button_link',
])

/** Types that are always web-only (include_in_pdf forced false). */
export const WEB_ONLY_TYPES_SET = new Set<AppraisalBlockType>([
  ...WEB_ONLY_BLOCK_TYPES,
  'button_link',
])

export function assertAppraisalBlockType(value: string): asserts value is AppraisalBlockType {
  if (!(APPRAISAL_BLOCK_TYPES as readonly string[]).includes(value)) {
    throw new ValidationError(`block type inválido: "${value}"`)
  }
}
