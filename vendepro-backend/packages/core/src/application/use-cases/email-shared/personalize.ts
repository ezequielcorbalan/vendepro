import type { SendEmailInput } from '../../ports/services/email-service'
import type { UnsubscribeTokenSigner } from '../../ports/services/unsubscribe-token-signer'
import { renderEmailHtml, renderEmailText, VENDEPRO_BRAND } from '../../../domain/rules/email-template'
import type { EmailBrand } from '../../../domain/rules/email-template'

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

export interface EmailFields {
  subject: string
  html: string
  text: string
  /** Vista previa en la bandeja. Opcional. */
  preheader?: string | null
}

/**
 * Arma un SendEmailInput personalizado, envuelto en el template base de
 * VendéPro y con el link de baja firmado en el footer.
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
  /** Branding de la org. Sin esto, el mail sale con la marca de la plataforma. */
  brand?: EmailBrand
  tags?: Record<string, string>
}): Promise<SendEmailInput> {
  const { recipient } = opts
  const sub = (s: string) => substituteVars(s, recipient)
  const token = await opts.signer.sign({ orgId: opts.orgId, email: recipient.email })
  const unsubscribeUrl = `${opts.publicBaseUrl}/u/${token}`
  const brand = opts.brand ?? VENDEPRO_BRAND

  return {
    from: opts.from,
    to: { email: recipient.email, name: recipient.name ?? '' },
    subject: sub(opts.fields.subject),
    html: renderEmailHtml({
      brand,
      contentHtml: sub(opts.fields.html),
      unsubscribeUrl,
      preheader: opts.fields.preheader ? sub(opts.fields.preheader) : null,
    }),
    text: renderEmailText({ brand, contentText: sub(opts.fields.text), unsubscribeUrl }),
    replyTo: opts.replyTo ?? undefined,
    tags: opts.tags,
  }
}
