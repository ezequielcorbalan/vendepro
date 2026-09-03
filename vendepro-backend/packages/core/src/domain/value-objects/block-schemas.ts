import { z } from 'zod'

// === Per-type data schemas ===

const HeroDataSchema = z.object({
  eyebrow: z.string().max(120).optional(),
  title: z.string().min(1).max(200),
  subtitle: z.string().max(300).optional(),
  cta: z.object({ label: z.string().min(1).max(40), href: z.string().min(1) }).optional(),
  background_image_url: z.string().url(),
  overlay_opacity: z.number().min(0).max(1),
})

const HeroSplitDataSchema = z.object({
  eyebrow: z.string().max(120).optional(),
  title: z.string().min(1).max(200),
  subtitle: z.string().max(300).optional(),
  cta: z.object({ label: z.string().min(1).max(40), href: z.string().min(1) }).optional(),
  media_url: z.string().url(),
  media_side: z.enum(['left', 'right']),
  accent_color: z.enum(['pink', 'orange', 'dark']),
})

const FeaturesGridDataSchema = z.object({
  title: z.string().max(200).optional(),
  subtitle: z.string().max(300).optional(),
  columns: z.union([z.literal(3), z.literal(4)]),
  items: z.array(z.object({
    icon: z.string().min(1).max(40),
    title: z.string().min(1).max(120),
    text: z.string().min(1).max(400),
  })).min(3).max(8),
})

const AmenitiesChipsDataSchema = z.object({
  title: z.string().max(120).optional(),
  chips: z.array(z.object({
    emoji: z.string().max(4).optional(),
    label: z.string().min(1).max(60),
  })).min(3).max(16),
})

const GalleryDataSchema = z.object({
  layout: z.enum(['mosaic', 'grid', 'carousel']),
  images: z.array(z.object({
    url: z.string().url(),
    alt: z.string().max(200).optional(),
    source: z.enum(['upload', 'external', 'property']),
    property_id: z.string().optional(),
  })).min(1).max(24),
})

const BenefitsListDataSchema = z.object({
  title: z.string().max(200).optional(),
  items: z.array(z.object({
    title: z.string().min(1).max(120),
    description: z.string().max(400).optional(),
  })).min(2).max(8),
})

const LeadFormDataSchema = z.object({
  title: z.string().min(1).max(200),
  subtitle: z.string().max(300).optional(),
  fields: z.array(z.object({
    key: z.enum(['name', 'phone', 'email', 'address', 'message']),
    label: z.string().min(1).max(60),
    required: z.boolean(),
  })).refine((fields) => {
    const keys = fields.map(f => f.key)
    return keys.includes('name') && keys.includes('phone')
  }, { message: 'lead-form debe incluir siempre los campos `name` y `phone`' }),
  submit_label: z.string().min(1).max(40),
  success_message: z.string().min(1).max(200),
  privacy_note: z.string().max(300).optional(),
})

const FooterDataSchema = z.object({
  agency_name: z.string().max(120).optional(),
  agency_registration: z.string().max(80).optional(),
  phone: z.string().max(40).optional(),
  email: z.string().email().optional().or(z.literal('')),
  whatsapp: z.string().max(40).optional(),
  instagram: z.string().max(60).optional(),
  disclaimer: z.string().max(500).optional(),
})

const AgentHeroDataSchema = z.object({
  name: z.string().min(1).max(120),
  headline: z.string().max(160).optional(),
  bio: z.string().max(1200).optional(),
  photo_url: z.string().url(),
  background_image_url: z.string().url().optional(),
  ctas: z.array(z.object({
    label: z.string().min(1).max(40),
    href: z.string().min(1),
    style: z.enum(['primary', 'secondary', 'whatsapp']),
  })).max(3),
  accent_color: z.enum(['pink', 'orange', 'dark']),
})

const AgentCredentialsDataSchema = z.object({
  title: z.string().max(200).optional(),
  license: z.string().max(80).optional(),
  years_experience: z.number().int().min(0).max(70).optional(),
  zones: z.array(z.string().min(1).max(60)).max(12),
  specialties: z.array(z.string().min(1).max(60)).max(8),
  stats: z.array(z.object({
    label: z.string().min(1).max(60),
    value: z.string().min(1).max(30),
  })).max(4),
})

const FaqDataSchema = z.object({
  title: z.string().max(200).optional(),
  items: z.array(z.object({
    question: z.string().min(1).max(200),
    answer: z.string().min(1).max(1200),
  })).min(2).max(12),
})

const CtaWhatsappDataSchema = z.object({
  title: z.string().min(1).max(200),
  subtitle: z.string().max(300).optional(),
  phone: z.string().min(1).max(40),
  message_template: z.string().max(300).optional(),
  button_label: z.string().min(1).max(40),
})

// === Registry ===

export const BLOCK_TYPES = [
  'hero',
  'hero-split',
  'features-grid',
  'amenities-chips',
  'gallery',
  'benefits-list',
  'lead-form',
  'footer',
  'agent-hero',
  'agent-credentials',
  'faq',
  'cta-whatsapp',
] as const

export type BlockType = typeof BLOCK_TYPES[number]

export const BLOCK_DATA_SCHEMAS: Record<BlockType, z.ZodTypeAny> = {
  'hero': HeroDataSchema,
  'hero-split': HeroSplitDataSchema,
  'features-grid': FeaturesGridDataSchema,
  'amenities-chips': AmenitiesChipsDataSchema,
  'gallery': GalleryDataSchema,
  'benefits-list': BenefitsListDataSchema,
  'lead-form': LeadFormDataSchema,
  'footer': FooterDataSchema,
  'agent-hero': AgentHeroDataSchema,
  'agent-credentials': AgentCredentialsDataSchema,
  'faq': FaqDataSchema,
  'cta-whatsapp': CtaWhatsappDataSchema,
}

// === Envelope schemas ===

export const BlockSchema = z.discriminatedUnion('type', BLOCK_TYPES.map((t) =>
  z.object({
    id: z.string().min(1),
    type: z.literal(t),
    visible: z.boolean(),
    // Marca opcional usada por las landings que actúan como plantilla de
    // tasación: bloques `is_variable=true` cambian por tasación (ej: FODA,
    // comparativos), los demás son fijos para todas las copias. No se valida
    // en endpoints — el frontend escribe/lee este flag.
    is_variable: z.boolean().optional(),
    // Marca que este bloque se rellena en la lectura pública con los datos del
    // perfil del agente (ver agent-bindings.ts). Los campos bindeados son
    // read-only en el editor.
    binding: z.literal('agent_profile').optional(),
    data: BLOCK_DATA_SCHEMAS[t],
  })
) as any)

export type Block = z.infer<typeof BlockSchema>

export const BlocksArraySchema = z.array(BlockSchema).min(1)

export const BLOCK_SCHEMAS = BLOCK_DATA_SCHEMAS // alias para uso externo

// === Helpers ===

export function validateBlock(input: unknown): { success: true; data: Block } | { success: false; error: string } {
  const parsed = BlockSchema.safeParse(input)
  if (parsed.success) return { success: true, data: parsed.data }
  return { success: false, error: parsed.error.message }
}

export function validateBlocks(input: unknown): { success: true; data: Block[] } | { success: false; error: string } {
  const parsed = BlocksArraySchema.safeParse(input)
  if (parsed.success) return { success: true, data: parsed.data }
  return { success: false, error: parsed.error.message }
}

export function isLeadFormBlock(block: Block): boolean {
  return block.type === 'lead-form'
}
