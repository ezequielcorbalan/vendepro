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

/**
 * Genera el borrador de una campaña de email con IA.
 * El resultado SIEMPRE es un borrador editable — la IA nunca envía.
 */
export interface EmailContentGenerator {
  generate(input: GenerateEmailContentInput): Promise<GeneratedEmailContent>
}
