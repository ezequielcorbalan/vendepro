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

export interface AIService {
  extractLeadIntent(text: string): Promise<LeadIntent>
  transcribeAudio(audioBuffer: ArrayBuffer, mimeType: string): Promise<string>
  extractMetricsFromScreenshot(imageBase64: string): Promise<Record<string, unknown>>
}
