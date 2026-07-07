import type { SendEmailInput } from '../../ports/services/email-service'
import type { UnsubscribeTokenSigner } from '../../ports/services/unsubscribe-token-signer'

export interface RecipientVars {
  email: string
  name: string | null
}

/** Reemplaza {{nombre}} / {{email}} en un texto. */
export function substituteVars(s: string, recipient: RecipientVars): string {
  const firstName = (recipient.name ?? '').trim().split(/\s+/)[0] || ''
  return s
    .replace(/\{\{\s*nombre\s*\}\}/gi, firstName)
    .replace(/\{\{\s*email\s*\}\}/gi, recipient.email)
}

/** Inserta el footer de baja antes de </body> (o al final si no hay). */
export function appendUnsubscribeHtml(html: string, url: string): string {
  const footer = `<p style="margin-top:32px;font-size:12px;color:#999;text-align:center;">` +
    `¿No querés recibir más estos emails? <a href="${url}" style="color:#999;">Cancelar suscripción</a></p>`
  return /<\/body>/i.test(html) ? html.replace(/<\/body>/i, `${footer}</body>`) : html + footer
}

export interface EmailFields {
  subject: string
  html: string
  text: string
}

/**
 * Arma un SendEmailInput personalizado con footer de baja firmado.
 * Compartido por campañas (Fase 3) y automatizaciones (Fase 5).
 */
export async function buildPersonalizedEmail(opts: {
  orgId: string
  recipient: RecipientVars
  fields: EmailFields
  from: { email: string; name: string }
  replyTo: string | null
  publicBaseUrl: string
  signer: UnsubscribeTokenSigner
  tags?: Record<string, string>
}): Promise<SendEmailInput> {
  const { recipient } = opts
  const sub = (s: string) => substituteVars(s, recipient)
  const token = await opts.signer.sign({ orgId: opts.orgId, email: recipient.email })
  const unsubscribeUrl = `${opts.publicBaseUrl}/u/${token}`

  return {
    from: opts.from,
    to: { email: recipient.email, name: recipient.name ?? '' },
    subject: sub(opts.fields.subject),
    html: appendUnsubscribeHtml(sub(opts.fields.html), unsubscribeUrl),
    text: `${sub(opts.fields.text)}\n\n—\nPara dejar de recibir estos emails: ${unsubscribeUrl}`,
    replyTo: opts.replyTo ?? undefined,
    tags: opts.tags,
  }
}
