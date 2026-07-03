export interface WebhookSendResult {
  ok: boolean
  /** HTTP status de la respuesta, o null si hubo timeout/error de red. */
  status: number | null
  error: string | null
}

/** Transporte de entregas: POST JSON firmado con HMAC-SHA256 del secret. */
export interface WebhookSender {
  send(url: string, secret: string, body: string): Promise<WebhookSendResult>
}
