import { z } from 'zod'
import {
  APPRAISAL_BLOCK_TYPES,
  WEB_ONLY_TYPES_SET,
  type AppraisalBlockType,
} from './appraisal-block-type'
import { BINDING_MODES, type BindingMode } from './appraisal-binding-mode'

const CoverData = z.object({
  title: z.string().max(200).optional(),
  subtitle: z.string().max(300).optional(),
  cover_image_url: z.string().url().optional().nullable(),
  agent_display: z.object({
    name: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().optional(),
    avatar_url: z.string().url().optional().nullable(),
  }).optional(),
})

const ProposalCommercialData = z.object({
  title: z.string().max(200).optional(),
  subtitle: z.string().max(300).optional(),
  items: z.array(z.object({
    icon: z.string().max(40).optional(),
    title: z.string().min(1).max(120),
    body: z.string().max(600),
  })).max(8),
})

const ServicesGridData = z.object({
  title: z.string().max(200).optional(),
  services: z.array(z.object({ icon: z.string().max(40).optional(), label: z.string().min(1).max(120) })).max(12),
  portals_logos: z.array(z.string().url()).max(8).optional(),
  badge_text: z.string().max(80).optional(),
})

const MarketStatsData = z.object({
  title: z.string().max(200).optional(),
  vars: z.array(z.string().regex(/^[a-zA-Z][a-zA-Z0-9_.]*$/)).max(8),
})

const FunnelChartData = z.object({
  title: z.string().max(200).optional(),
  funnel: z.array(z.object({ label: z.string(), value: z.number() })).max(10),
  ranges: z.array(z.object({ label: z.string(), from: z.number(), to: z.number(), color: z.string().optional() })).max(6).optional(),
})

const MethodologyData = z.object({
  title: z.string().max(200).optional(),
  body: z.string().max(2000),
  image_url: z.string().url().optional().nullable(),
  highlight_text: z.string().max(400).optional(),
})

const NotaryChartsData = z.object({
  title: z.string().max(200).optional(),
  chart_1_var: z.string().optional(),
  chart_2_var: z.string().optional(),
})

const PropertyDataData = z.object({
  title: z.string().max(200).optional(),
  source: z.literal('appraisal.*').optional(),
})

const SwotData = z.object({
  title: z.string().max(200).optional(),
  source: z.literal('appraisal.swot').optional(),
})

const ZoneMapData = z.object({
  title: z.string().max(200).optional(),
  map_image_url: z.string().url().optional().nullable(),
  neighborhood_name: z.string().optional(),
  min_m2_price: z.number().optional(),
  avg_m2_price: z.number().optional(),
  median_m2_price: z.number().optional(),
  published_count: z.number().int().nonnegative().optional(),
})

const ComparablesListData = z.object({
  title: z.string().max(200).optional(),
  source: z.literal('appraisal.comparables').optional(),
  variant: z.enum(['published', 'reserved']),
})

const PriceProjectionData = z.object({
  title: z.string().max(200).optional(),
  source: z.literal('appraisal.prices').optional(),
})

const WorkConditionsData = z.object({
  title: z.string().max(200).optional(),
  honorarios_pct: z.number().min(0).max(100).optional(),
  exclusividad_dias: z.number().int().min(0).max(365).optional(),
  required_docs: z.array(z.string()).max(20).optional(),
  extras: z.array(z.string()).max(20).optional(),
  legal_text: z.string().max(2000).optional(),
  signature_image_url: z.string().url().optional().nullable(),
})

const VideoGalleryData = z.object({
  title: z.string().max(200).optional(),
  videos: z.array(z.object({
    url: z.string().url(),
    caption: z.string().max(200).optional(),
    provider: z.enum(['youtube', 'vimeo', 'r2']),
  })).max(12),
})

const ExtraMediaData = z.object({
  title: z.string().max(200).optional(),
  media: z.array(z.object({
    type: z.enum(['image', 'video']),
    url: z.string().url(),
    caption: z.string().max(200).optional(),
  })).max(24),
})

const CtaWhatsappData = z.object({
  text: z.string().min(1).max(200),
  phone: z.string().min(6).max(30),
  pre_filled_message: z.string().max(500).optional(),
})

const AgentContactCardData = z.object({
  avatar_url: z.string().url().optional().nullable(),
  name: z.string().min(1).max(120),
  phone: z.string().max(30).optional(),
  email: z.string().email().optional().or(z.literal('')),
  whatsapp_link: z.string().url().optional().nullable(),
})

// ── Bloques libres (editor WYSIWYG por tasación) ──────────────────────
// Schemas laxos a propósito: un bloque recién insertado arranca vacío
// (data mínima). La "completitud" para publicar/PDF se decide en el
// frontend (block-completeness), no acá.
const HeadingData = z.object({
  text: z.string().max(300).optional(),
  level: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
  align: z.enum(['left', 'center', 'right']).optional(),
})

const RichTextData = z.object({
  html: z.string().max(20000).optional(),
})

const ImageData = z.object({
  url: z.string().url().optional().nullable(),
  caption: z.string().max(300).optional(),
  width: z.enum(['full', 'wide', 'medium']).optional(),
  align: z.enum(['left', 'center', 'right']).optional(),
})

const GalleryData = z.object({
  images: z.array(z.object({
    url: z.string().url(),
    caption: z.string().max(200).optional(),
  })).max(30).optional(),
  columns: z.union([z.literal(2), z.literal(3), z.literal(4)]).optional(),
})

const DividerData = z.object({
  style: z.enum(['line', 'space']).optional(),
  size: z.enum(['sm', 'md', 'lg']).optional(),
})

const CalloutData = z.object({
  text: z.string().max(1000).optional(),
  tone: z.enum(['info', 'accent']).optional(),
})

const ButtonLinkData = z.object({
  label: z.string().max(120).optional(),
  url: z.string().url().optional().nullable(),
})

const dataByType: Record<AppraisalBlockType, z.ZodTypeAny> = {
  cover: CoverData,
  proposal_commercial: ProposalCommercialData,
  services_grid: ServicesGridData,
  market_stats: MarketStatsData,
  funnel_chart: FunnelChartData,
  methodology: MethodologyData,
  notary_charts: NotaryChartsData,
  property_data: PropertyDataData,
  swot: SwotData,
  zone_map: ZoneMapData,
  comparables_list: ComparablesListData,
  price_projection: PriceProjectionData,
  work_conditions: WorkConditionsData,
  video_gallery: VideoGalleryData,
  extra_media: ExtraMediaData,
  cta_whatsapp: CtaWhatsappData,
  agent_contact_card: AgentContactCardData,
  heading: HeadingData,
  rich_text: RichTextData,
  image: ImageData,
  gallery: GalleryData,
  divider: DividerData,
  callout: CalloutData,
  button_link: ButtonLinkData,
}

const TemplateBlockSchema = z.object({
  id: z.string().min(1),
  type: z.enum(APPRAISAL_BLOCK_TYPES as unknown as [AppraisalBlockType, ...AppraisalBlockType[]]),
  binding_mode: z.enum(BINDING_MODES as unknown as [BindingMode, ...BindingMode[]]),
  include_in_pdf: z.boolean(),
  sort_order: z.number().int(),
  data: z.unknown(),
}).superRefine((b, ctx) => {
  if (WEB_ONLY_TYPES_SET.has(b.type as AppraisalBlockType) && b.include_in_pdf !== false) {
    ctx.addIssue({ code: 'custom', path: ['include_in_pdf'], message: `tipo "${b.type}" es web-only; include_in_pdf debe ser false` })
    return
  }
  const schema = dataByType[b.type as AppraisalBlockType]
  const r = schema.safeParse(b.data)
  if (!r.success) {
    ctx.addIssue({ code: 'custom', path: ['data'], message: `data inválido para "${b.type}": ${r.error.issues[0]?.message ?? 'unknown'}` })
  }
})

export type AppraisalTemplateBlock = z.infer<typeof TemplateBlockSchema>

export type ValidateResult =
  | { success: true; data: AppraisalTemplateBlock[] }
  | { success: false; error: string }

export function validateAppraisalBlocks(blocks: unknown): ValidateResult {
  const r = z.array(TemplateBlockSchema).safeParse(blocks)
  if (!r.success) return { success: false, error: r.error.issues[0]?.message ?? 'invalid' }
  return { success: true, data: r.data }
}
