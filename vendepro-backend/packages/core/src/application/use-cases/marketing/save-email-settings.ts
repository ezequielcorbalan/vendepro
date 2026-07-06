import type { EmailSettingsRepository } from '../../ports/repositories/email-settings-repository'
import { EmailSettings } from '../../../domain/entities/email-settings'
import { ValidationError } from '../../../domain/errors/validation-error'

export interface SaveEmailSettingsInput {
  orgId: string
  from_name?: string | null
  from_email?: string | null
  reply_to?: string | null
  enabled?: boolean
}

/**
 * Normaliza campos de texto del form: '' → null (permite limpiar),
 * trim de espacios. undefined se preserva (patch parcial).
 */
function cleanText(v: string | null | undefined): string | null | undefined {
  if (v === undefined) return undefined
  const t = (v ?? '').trim()
  return t === '' ? null : t
}

function cleanEmail(v: string | null | undefined, field: string): string | null | undefined {
  const t = cleanText(v)
  if (t === undefined || t === null) return t
  const lower = t.toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lower)) {
    throw new ValidationError(`${field} inválido`)
  }
  return lower
}

export class SaveEmailSettingsUseCase {
  constructor(private readonly repo: EmailSettingsRepository) {}

  async execute(input: SaveEmailSettingsInput): Promise<{ ok: true }> {
    const existing = await this.repo.findByOrg(input.orgId)

    const next = existing ?? EmailSettings.create({
      org_id: input.orgId,
      from_name: null,
      from_email: null,
      reply_to: null,
      resend_domain_id: null,
    })

    const fromName = cleanText(input.from_name)
    const fromEmail = cleanEmail(input.from_email, 'from_email')
    const replyTo = cleanEmail(input.reply_to, 'reply_to')

    const enabled = input.enabled !== undefined ? input.enabled : next.enabled
    const effectiveFrom = fromEmail !== undefined ? fromEmail : next.from_email
    if (enabled && !effectiveFrom) {
      throw new ValidationError('No se puede habilitar sin un email remitente (from_email)')
    }

    next.update({
      from_name: fromName !== undefined ? fromName : next.from_name,
      from_email: effectiveFrom,
      reply_to: replyTo !== undefined ? replyTo : next.reply_to,
      enabled,
    })

    await this.repo.save(next)
    return { ok: true }
  }
}
