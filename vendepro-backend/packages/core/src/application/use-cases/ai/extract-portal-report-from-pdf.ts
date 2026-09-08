import type {
  PortalReportData,
  PortalReportExtractor,
} from '../../ports/services/ai-service'

export interface ExtractPortalReportFromPdfInput {
  /** PDF en base64, sin el prefijo `data:`. */
  pdfBase64: string
}

/**
 * Tope de tamaño del PDF, en bytes de archivo (no de base64).
 *
 * Gemini acepta hasta 20 MB de request inline y el base64 infla ~33%, así que
 * el techo real ronda los 14 MB. Cortamos antes, con un mensaje que se entiende,
 * en vez de dejar que el proveedor devuelva un 400 opaco.
 */
const MAX_PDF_BYTES = 10 * 1024 * 1024

function fail(message: string, statusCode: number): Error & { statusCode: number } {
  const err = new Error(message) as Error & { statusCode: number }
  err.statusCode = statusCode
  return err
}

/** Bytes reales que representa un base64, sin decodificarlo. */
export function base64ByteLength(base64: string): number {
  const clean = base64.replace(/\s/g, '')
  if (clean.length === 0) return 0
  const padding = clean.endsWith('==') ? 2 : clean.endsWith('=') ? 1 : 0
  return Math.floor((clean.length * 3) / 4) - padding
}

/**
 * Lee el PDF de reporte de KiteProp y devuelve las métricas por portal para
 * precargar el paso 2 del wizard de reportes.
 *
 * Todos los campos pueden venir en null: el PDF de KiteProp no tiene un formato
 * fijo y cambia según qué portales tenga conectada la inmobiliaria. La UI
 * precarga lo que llegó y el agente completa el resto a mano — nunca se pisa un
 * valor cargado con un null del modelo.
 */
export class ExtractPortalReportFromPdfUseCase {
  constructor(private readonly extractor: PortalReportExtractor) {}

  async execute(input: ExtractPortalReportFromPdfInput): Promise<PortalReportData> {
    const pdfBase64 = (input.pdfBase64 ?? '').trim()
    if (!pdfBase64) throw fail('No llegó ningún PDF.', 400)

    const bytes = base64ByteLength(pdfBase64)
    if (bytes > MAX_PDF_BYTES) {
      throw fail(
        `El PDF pesa ${(bytes / 1024 / 1024).toFixed(1)} MB y el máximo son ${MAX_PDF_BYTES / 1024 / 1024} MB.`,
        413,
      )
    }

    return await this.extractor.extractPortalReportFromPdf({ pdfBase64 })
  }
}
