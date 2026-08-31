import type { EmailSettingsRepository } from '../../ports/repositories/email-settings-repository'
import type { OrganizationRepository } from '../../ports/repositories/organization-repository'
import type { EmailService } from '../../ports/services/email-service'
import { ValidationError } from '../../../domain/errors/validation-error'
import { renderEmailHtml, renderEmailText, VENDEPRO_BRAND } from '../../../domain/rules/email-template'
import type { EmailBrand } from '../../../domain/rules/email-template'

export interface SendTestEmailInput {
  orgId: string
  to: string
}

export interface SendTestEmailResult {
  ok: boolean
  error?: string
}

/**
 * Envía un email de prueba con la config de la org, para verificar
 * remitente/dominio antes de habilitar campañas. No requiere
 * enabled=true: el test es justamente el paso previo a habilitar.
 *
 * Sale con el mismo template base que el resto de los envíos: la prueba
 * también sirve para ver cómo va a quedar el marco de marca.
 */
export class SendTestEmailUseCase {
  constructor(
    private readonly settingsRepo: EmailSettingsRepository,
    private readonly emailService: EmailService,
    /** Opcional: logo y color de la org para el encabezado del template. */
    private readonly orgRepo?: OrganizationRepository,
  ) {}

  async execute(input: SendTestEmailInput): Promise<SendTestEmailResult> {
    const to = (input.to ?? '').trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      throw new ValidationError('Email de destino inválido')
    }

    const settings = await this.settingsRepo.findByOrg(input.orgId)
    if (!settings?.from_email) {
      throw new ValidationError('Configurá el email remitente antes de enviar una prueba')
    }

    const fromName = settings.from_name ?? 'VendéPro'
    const brand = await this.resolveBrand(input.orgId, settings.from_name)
    const text = `Este es un email de prueba enviado desde ${fromName} (${settings.from_email}) vía VendéPro. Si lo recibiste, la configuración de envío funciona correctamente.`
    try {
      await this.emailService.send({
        from: { email: settings.from_email, name: fromName },
        to: { email: to, name: to },
        replyTo: settings.reply_to ?? undefined,
        subject: `Email de prueba — ${fromName}`,
        html: renderEmailHtml({
          brand,
          contentHtml: buildTestContent(fromName, settings.from_email),
          preheader: 'Si estás leyendo esto, el envío de emails funciona.',
        }),
        text: renderEmailText({ brand, contentText: text }),
        tags: { kind: 'test' },
      })
      return { ok: true }
    } catch (err: any) {
      // El error del provider (dominio sin verificar, API key inválida, etc.)
      // se devuelve al UI para que el admin pueda corregir la config.
      return { ok: false, error: err?.message ?? 'Error desconocido al enviar' }
    }
  }

  /** Branding real de la org, para que la prueba muestre el mail tal cual sale. */
  private async resolveBrand(orgId: string, fromName: string | null): Promise<EmailBrand> {
    const fallback: EmailBrand = { ...VENDEPRO_BRAND, name: fromName ?? VENDEPRO_BRAND.name }
    if (!this.orgRepo) return fallback
    try {
      const org = await this.orgRepo.findById(orgId)
      if (!org) return fallback
      return {
        name: fromName ?? org.name,
        logoUrl: org.logo_url,
        color: org.brand_color,
        accentColor: VENDEPRO_BRAND.accentColor,
      }
    } catch {
      return fallback
    }
  }
}

/** Sólo el contenido: el marco de marca lo pone `renderEmailHtml`. */
function buildTestContent(fromName: string, fromEmail: string): string {
  return `<h2 style="margin:0 0 16px;font-size:20px;color:#111827;">✓ Email de prueba</h2>
<p style="margin:0 0 12px;">
  Este es un email de prueba enviado desde <strong>${escapeHtml(fromName)}</strong>
  (${escapeHtml(fromEmail)}) vía VendéPro.
</p>
<p style="margin:0;">
  Si lo estás leyendo, la configuración de envío funciona correctamente.
</p>`
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
