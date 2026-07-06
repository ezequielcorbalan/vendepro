import type { EmailSettingsRepository } from '../../ports/repositories/email-settings-repository'
import type { EmailService } from '../../ports/services/email-service'
import { ValidationError } from '../../../domain/errors/validation-error'

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
 */
export class SendTestEmailUseCase {
  constructor(
    private readonly settingsRepo: EmailSettingsRepository,
    private readonly emailService: EmailService,
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
    try {
      await this.emailService.send({
        from: { email: settings.from_email, name: fromName },
        to: { email: to, name: to },
        replyTo: settings.reply_to ?? undefined,
        subject: `Email de prueba — ${fromName}`,
        html: buildTestHtml(fromName, settings.from_email),
        text: `Este es un email de prueba enviado desde ${fromName} (${settings.from_email}) vía VendéPro. Si lo recibiste, la configuración de envío funciona correctamente.`,
        tags: { kind: 'test' },
      })
      return { ok: true }
    } catch (err: any) {
      // El error del provider (dominio sin verificar, API key inválida, etc.)
      // se devuelve al UI para que el admin pueda corregir la config.
      return { ok: false, error: err?.message ?? 'Error desconocido al enviar' }
    }
  }
}

function buildTestHtml(fromName: string, fromEmail: string): string {
  return `<!DOCTYPE html>
<html>
  <body style="font-family: Poppins, Arial, sans-serif; background: #f7f7f8; padding: 24px;">
    <div style="max-width: 480px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 32px; border: 1px solid #eee;">
      <h2 style="color: #ff007c; margin: 0 0 16px;">✓ Email de prueba</h2>
      <p style="color: #333; line-height: 1.6;">
        Este es un email de prueba enviado desde <strong>${escapeHtml(fromName)}</strong>
        (${escapeHtml(fromEmail)}) vía VendéPro.
      </p>
      <p style="color: #333; line-height: 1.6;">
        Si lo estás leyendo, la configuración de envío funciona correctamente.
      </p>
      <p style="color: #999; font-size: 12px; margin-top: 24px;">
        Enviado por VendéPro · Email marketing
      </p>
    </div>
  </body>
</html>`
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
