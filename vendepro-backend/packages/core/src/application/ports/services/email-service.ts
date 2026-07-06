export interface SendEmailInput {
  to: { email: string; name: string }
  from: { email: string; name: string }
  subject: string
  html: string
  text: string
  /** Dirección de respuesta (si difiere del from). */
  replyTo?: string
  /** Tags para tracking/filtrado en el provider (ej: campaign_id). */
  tags?: Record<string, string>
  /** Evita envíos duplicados ante reintentos (soportado por Resend). */
  idempotencyKey?: string
}

export interface EmailService {
  send(input: SendEmailInput): Promise<void>
  /**
   * Envío en lote (hasta 100 por request en Resend). Opcional:
   * providers legacy (emBlue) no lo implementan.
   */
  sendBatch?(inputs: SendEmailInput[]): Promise<void>
}
