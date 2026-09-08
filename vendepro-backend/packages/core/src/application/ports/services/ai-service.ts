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
  extractMetricsFromScreenshot(imageBase64: string, mimeType?: string): Promise<Record<string, unknown>>
  extractComparableFromScreenshot(imageBase64: string, mimeType?: string): Promise<ComparablePropertyData>

  editLandingBlock(input: EditBlockInput): Promise<EditBlockResult>
  editLandingGlobal(input: EditGlobalInput): Promise<EditGlobalResult>
}

// ── Extracción de aviso desde el TEXTO de su página ──────────────
//
// Puerto aparte y no un método más de `AIService` a propósito: `AIService` lo
// implementan dos adapters (Gemini y el viejo Groq, todavía vivo en tests), y
// agregarle métodos obligatorios rompe al que no los tiene. Los puertos chicos
// los implementa sólo quien de verdad los ofrece.

export interface ExtractComparableFromTextInput {
  /** Texto plano de la página del aviso (HTML ya limpiado). */
  text: string
  /** URL de origen, para que el modelo pueda devolverla en `zonaprop_url`. */
  sourceUrl?: string
}

export interface ListingTextExtractor {
  extractComparableFromText(input: ExtractComparableFromTextInput): Promise<ComparablePropertyData>
}

// ── Extracción del PDF de reporte de KiteProp ────────────────────

/** Una fila de métricas por portal dentro del reporte. */
export interface PortalReportRow {
  /** Clave del portal normalizada: zonaprop | argenprop | mercadolibre | manual. */
  source: string
  impressions: number | null
  portal_visits: number | null
  inquiries: number | null
}

export interface PortalReportData {
  portals: PortalReportRow[]
  /** Total de visitas presenciales del período, si el PDF lo informa. */
  total_visits_presenciales: number | null
  market_comparison: { avg_market_price: number | null } | null
}

export interface ExtractPortalReportInput {
  /** PDF en base64, sin el prefijo `data:`. */
  pdfBase64: string
}

export interface PortalReportExtractor {
  extractPortalReportFromPdf(input: ExtractPortalReportInput): Promise<PortalReportData>
}
