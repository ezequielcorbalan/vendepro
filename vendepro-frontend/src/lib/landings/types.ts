// Espejan los shapes definidos en vendepro-backend/packages/core/src/domain/value-objects/block-schemas.ts
// Si el backend cambia, actualizar acá manualmente (o migrar a paquete compartido en fase futura).

export type BlockType =
  | 'hero'
  | 'hero-split'
  | 'features-grid'
  | 'amenities-chips'
  | 'gallery'
  | 'benefits-list'
  | 'lead-form'
  | 'footer'
  | 'agent-hero'
  | 'agent-credentials'
  | 'faq'
  | 'cta-whatsapp'

export interface CtaData { label: string; href: string }

export interface HeroData {
  eyebrow?: string
  title: string
  subtitle?: string
  cta?: CtaData
  background_image_url: string
  overlay_opacity: number
}

export interface HeroSplitData {
  eyebrow?: string
  title: string
  subtitle?: string
  cta?: CtaData
  media_url: string
  media_side: 'left' | 'right'
  accent_color: 'pink' | 'orange' | 'dark'
}

export interface FeaturesGridData {
  title?: string
  subtitle?: string
  columns: 3 | 4
  items: Array<{ icon: string; title: string; text: string }>
}

export interface AmenitiesChipsData {
  title?: string
  chips: Array<{ emoji?: string; label: string }>
}

export interface GalleryImage {
  url: string
  alt?: string
  source: 'upload' | 'external' | 'property'
  property_id?: string
}

export interface GalleryData {
  layout: 'mosaic' | 'grid' | 'carousel'
  images: GalleryImage[]
}

export interface BenefitsListData {
  title?: string
  items: Array<{ title: string; description?: string }>
}

export type LeadFormFieldKey = 'name' | 'phone' | 'email' | 'address' | 'message'
export interface LeadFormField {
  key: LeadFormFieldKey
  label: string
  required: boolean
}

export interface LeadFormData {
  title: string
  subtitle?: string
  fields: LeadFormField[]
  submit_label: string
  success_message: string
  privacy_note?: string
}

export interface FooterData {
  agency_name?: string
  agency_registration?: string
  phone?: string
  email?: string
  whatsapp?: string
  instagram?: string
  disclaimer?: string
}

export interface AgentHeroCta {
  label: string
  href: string
  style: 'primary' | 'secondary' | 'whatsapp'
}

export interface AgentHeroData {
  name: string
  headline?: string
  bio?: string
  photo_url: string
  background_image_url?: string
  ctas: AgentHeroCta[]
  accent_color: 'pink' | 'orange' | 'dark'
}

export interface AgentCredentialsStat {
  label: string
  value: string
}

export interface AgentCredentialsData {
  title?: string
  license?: string
  years_experience?: number
  zones: string[]
  specialties: string[]
  stats: AgentCredentialsStat[]
}

export interface FaqItem {
  question: string
  answer: string
}

export interface FaqData {
  title?: string
  items: FaqItem[]
}

export interface CtaWhatsappData {
  title: string
  subtitle?: string
  phone: string
  message_template?: string
  button_label: string
}

export type BlockDataMap = {
  'hero': HeroData
  'hero-split': HeroSplitData
  'features-grid': FeaturesGridData
  'amenities-chips': AmenitiesChipsData
  'gallery': GalleryData
  'benefits-list': BenefitsListData
  'lead-form': LeadFormData
  'footer': FooterData
  'agent-hero': AgentHeroData
  'agent-credentials': AgentCredentialsData
  'faq': FaqData
  'cta-whatsapp': CtaWhatsappData
}

export type Block<T extends BlockType = BlockType> = {
  id: string
  type: T
  visible: boolean
  data: BlockDataMap[T]
  /**
   * Si true, este bloque se podrá editar al crear cada tasación
   * (cuando la landing se usa como plantilla de tasación). Si false/undefined,
   * el contenido es fijo y se hereda de la plantilla.
   */
  is_variable?: boolean
  /**
   * Marca que este bloque se rellena en la lectura pública con los datos del
   * perfil del agente (ver `agent-bindings.ts` en el backend). Los campos
   * bindeados son read-only en el editor.
   */
  binding?: 'agent_profile'
}

export type LandingKind = 'lead_capture' | 'property'
export type LandingStatus = 'draft' | 'pending_review' | 'published' | 'archived'

export interface LeadRules {
  assigned_agent_id?: string
  tags?: string[]
  campaign?: string
  notify_channels?: Array<'email' | 'whatsapp'>
}

export type LandingTemplateType = 'tasacion' | null

export interface Landing {
  id: string
  org_id: string
  agent_id: string
  template_id: string
  kind: LandingKind
  slug_base: string
  slug_suffix: string
  full_slug: string
  status: LandingStatus
  blocks: Block[]
  brand_voice: string | null
  lead_rules: LeadRules | null
  seo_title: string | null
  seo_description: string | null
  og_image_url: string | null
  published_version_id: string | null
  published_at: string | null
  published_by: string | null
  last_review_note: string | null
  /**
   * Si la landing es plantilla de tasación, se setea a 'tasacion'.
   * Backend lo agrega más adelante; mientras tanto puede venir undefined.
   */
  template_type?: 'tasacion' | null
  created_at: string
  updated_at: string
}

export interface LandingTemplate {
  id: string
  org_id: string | null
  name: string
  kind: LandingKind
  description: string | null
  preview_image_url: string | null
  blocks: Block[]
  active: boolean
  sort_order: number
}

export interface LandingVersion {
  id: string
  landing_id: string
  version_number: number
  blocks: Block[]
  label: 'auto-save' | 'manual-save' | 'ai-edit' | 'publish'
  created_by: string
  created_at: string
}

export interface AnalyticsSummary {
  pageviews: number
  unique_visitors: number
  cta_clicks: number
  form_starts: number
  form_submits: number
  conversion_rate: number
  pageviews_by_day: Array<{ date: string; count: number }>
  top_utm_sources: Array<{ source: string; count: number }>
}
