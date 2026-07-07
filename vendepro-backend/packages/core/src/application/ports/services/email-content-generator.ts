export interface GenerateEmailContentInput {
  /** Brief del usuario: qué quiere comunicar. */
  brief: string
  /** Tipo de campaña para orientar el tono/estructura. */
  kind?: 'nueva_propiedad' | 'newsletter' | 'seguimiento' | 'reactivacion' | 'otro'
  /** Nombre de la inmobiliaria (firma del email). */
  orgName?: string | null
  /** A quién le habla (descripción del segmento elegido). */
  audienceDescription?: string | null
  /** Color primario de marca para el HTML (hex). */
  brandColor?: string | null
}

export interface GeneratedEmailContent {
  subject: string
  preheader: string
  html: string
  text: string
}

export interface GenerateSequenceInput {
  /** Objetivo global de la secuencia. */
  brief: string
  /** Cantidad de emails en la secuencia. */
  stepCount: number
  orgName?: string | null
  audienceDescription?: string | null
  brandColor?: string | null
}

export interface GeneratedSequenceStep extends GeneratedEmailContent {
  /** Demora sugerida desde el paso anterior (horas). */
  delay_hours: number
}

/**
 * Genera el borrador de una campaña de email con IA.
 * El resultado SIEMPRE es un borrador editable — la IA nunca envía.
 */
export interface EmailContentGenerator {
  generate(input: GenerateEmailContentInput): Promise<GeneratedEmailContent>
  /**
   * Genera una secuencia coordinada de N emails (drip). Cada paso incluye
   * una demora sugerida respecto del anterior.
   */
  generateSequence(input: GenerateSequenceInput): Promise<GeneratedSequenceStep[]>
}
