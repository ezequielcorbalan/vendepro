import type { UserRepository } from '../../ports/repositories/user-repository'
import type { PasswordResetTokenRepository } from '../../ports/repositories/password-reset-token-repository'
import type { EmailService } from '../../ports/services/email-service'
import type { IdGenerator } from '../../ports/id-generator'
import { PasswordResetToken } from '../../../domain/entities/password-reset-token'

export interface RequestPasswordResetInput {
  email: string
  appBaseUrl: string
  fromEmail: string
  fromName: string
}

const TOKEN_TTL_MS = 60 * 60 * 1000 // 1 hour

export class RequestPasswordResetUseCase {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly tokenRepo: PasswordResetTokenRepository,
    private readonly emailService: EmailService,
    private readonly idGen: IdGenerator,
  ) {}

  async execute(input: RequestPasswordResetInput): Promise<void> {
    const email = input.email.toLowerCase().trim()
    const user = await this.userRepo.findByEmail(email)

    // Never reveal whether the email is registered
    if (!user) return

    // Generate a 64-char hex reset token (two 32-char concats → 256 bits entropy).
    // 128 bits would be cryptographically sufficient; using 256 keeps parity
    // with the original route which used 32 random bytes.
    const resetToken = `${this.idGen.generate()}${this.idGen.generate()}`

    const expiresAt = new Date(Date.now() + TOKEN_TTL_MS).toISOString()
    const tokenEntity = PasswordResetToken.create({
      token: resetToken,
      user_id: user.id,
      org_id: user.org_id ?? 'org_mg',
      expires_at: expiresAt,
      used: false,
    })
    await this.tokenRepo.save(tokenEntity)

    const resetLink = `${input.appBaseUrl.replace(/\/$/, '')}/reset-password?token=${resetToken}`
    const subject = 'Recuperá tu contraseña — VendéPro'
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#fff;">
        <h2 style="color:#ff007c;margin-bottom:8px;">Recuperá tu contraseña</h2>
        <p style="color:#333;">Hola <strong>${user.full_name}</strong>,</p>
        <p style="color:#555;">Recibimos una solicitud para restablecer la contraseña de tu cuenta en <strong>VendéPro CRM</strong>.</p>
        <p style="margin:28px 0;">
          <a href="${resetLink}"
             style="background:#ff007c;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block;">
            Recuperar contraseña
          </a>
        </p>
        <p style="color:#888;font-size:13px;">Este link es válido por <strong>1 hora</strong>. Si no solicitaste este cambio, podés ignorar este email.</p>
        <hr style="border:none;border-top:1px solid #eee;margin:24px 0;" />
        <p style="color:#aaa;font-size:12px;">O copiá este link en tu navegador:</p>
        <p style="color:#aaa;font-size:11px;word-break:break-all;">${resetLink}</p>
      </div>
    `
    const text = `Hola ${user.full_name}, ingresá al siguiente link para recuperar tu contraseña: ${resetLink} (válido por 1 hora)`

    await this.emailService.send({
      from: { email: input.fromEmail, name: input.fromName },
      to: { email: user.email, name: user.full_name },
      subject,
      html,
      text,
    })
  }
}
