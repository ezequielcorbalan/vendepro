import { isUndeliverableEmail } from '@vendepro/core'
import type { EmailService, SendEmailInput } from '@vendepro/core'

const RESEND_API_URL = 'https://api.resend.com'
/** Límite del endpoint /emails/batch de Resend. */
export const RESEND_BATCH_LIMIT = 100

export class ResendEmailService implements EmailService {
  constructor(private readonly apiKey: string) {}

  async send(input: SendEmailInput): Promise<void> {
    // Puerta unica de salida: filtrar aca cubre automatizaciones, campanas,
    // emails de prueba y recuperacion de contrasena de una sola vez.
    if (isUndeliverableEmail(input.to?.email)) {
      console.warn(`[ResendEmailService] omitido: ${input.to?.email} es un dominio reservado, no entregable`)
      return
    }
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    }
    if (input.idempotencyKey) headers['Idempotency-Key'] = input.idempotencyKey

    const res = await fetch(`${RESEND_API_URL}/emails`, {
      method: 'POST',
      headers,
      body: JSON.stringify(toResendPayload(input)),
    })
    if (!res.ok) {
      throw new Error(`Resend send failed: ${res.status} ${await safeErrorMessage(res)}`)
    }
  }

  async sendBatch(inputs: SendEmailInput[]): Promise<void> {
    const omitidos = inputs.filter(i => isUndeliverableEmail(i.to?.email))
    if (omitidos.length > 0) {
      console.warn(`[ResendEmailService] batch: ${omitidos.length} de ${inputs.length} omitidos por dominio reservado`)
      inputs = inputs.filter(i => !isUndeliverableEmail(i.to?.email))
    }
    if (inputs.length === 0) return
    if (inputs.length > RESEND_BATCH_LIMIT) {
      throw new Error(`Resend batch admite hasta ${RESEND_BATCH_LIMIT} emails por request (recibidos: ${inputs.length})`)
    }
    const res = await fetch(`${RESEND_API_URL}/emails/batch`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(inputs.map(toResendPayload)),
    })
    if (!res.ok) {
      throw new Error(`Resend batch failed: ${res.status} ${await safeErrorMessage(res)}`)
    }
  }
}

function toResendPayload(input: SendEmailInput) {
  return {
    from: formatAddress(input.from),
    to: [formatAddress(input.to)],
    subject: input.subject,
    html: input.html,
    text: input.text,
    ...(input.replyTo ? { reply_to: input.replyTo } : {}),
    ...(input.tags
      ? { tags: Object.entries(input.tags).map(([name, value]) => ({ name, value })) }
      : {}),
  }
}

/** "Nombre <email>" — formato que Resend acepta para from/to. */
function formatAddress(addr: { email: string; name: string }): string {
  const name = (addr.name ?? '').trim()
  return name ? `${name} <${addr.email}>` : addr.email
}

/** Extrae el mensaje de error del body JSON de Resend sin romper si no es JSON. */
async function safeErrorMessage(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as any
    return body?.message ?? body?.error ?? ''
  } catch {
    return ''
  }
}
