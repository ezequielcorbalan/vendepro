import type { Block, BlockType } from '../../../domain/value-objects/block-schemas'

export interface LeadIntent {
  full_name?: string
  phone?: string
  email?: string
  neighborhood?: string
  property_type?: string
  operation?: string
  notes?: string
  budget?: number
}

export interface EditBlockInput {
  blockType: BlockType
  blockData: Record<string, unknown>
  prompt: string
  brandVoice?: string | null
}

export interface EditGlobalInput {
  blocks: Block[]
  prompt: string
  brandVoice?: string | null
}

export type EditBlockResult =
  | { status: 'ok'; data: Record<string, unknown> }
  | { status: 'error'; reason: 'schema_mismatch' | 'provider_error' | 'timeout'; detail?: string }

export type EditGlobalResult =
  | { status: 'ok'; blocks: Block[] }
  | { status: 'error'; reason: 'schema_mismatch' | 'provider_error' | 'timeout'; detail?: string }

export interface ComparablePropertyData {
  address?: string | null
  zonaprop_url?: string | null
  total_area?: number | null
  covered_area?: number | null
  price?: number | null
  usd_per_m2?: number | null
  days_on_market?: number | null
  views_per_day?: number | null
  age?: number | null
}

export interface AIService {
  extractLeadIntent(text: string): Promise<LeadIntent>
  extractLeadFromImage(imageBase64: string, mimeType?: string): Promise<LeadIntent>
  transcribeAudio(audioBuffer: ArrayBuffer, mimeType: string): Promise<string>
  extractMetricsFromScreenshot(imageBase64: string): Promise<Record<string, unknown>>
  extractComparableFromScreenshot(imageBase64: string, mimeType?: string): Promise<ComparablePropertyData>

  editLandingBlock(input: EditBlockInput): Promise<EditBlockResult>
  editLandingGlobal(input: EditGlobalInput): Promise<EditGlobalResult>
}
