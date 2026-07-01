import { SignJWT, jwtVerify } from 'jose'
import type { AuthService, CreateTokenOptions } from '@vendepro/core'

export class JwtAuthService implements AuthService {
  private readonly secret: Uint8Array
  private readonly tokenTTL = 60 * 60 * 24 * 7 // 7 days

  constructor(jwtSecret: string) {
    this.secret = new TextEncoder().encode(jwtSecret)
  }

  async hashPassword(password: string): Promise<string> {
    const salt = 'reportes-mg-salt-2026'
    const encoder = new TextEncoder()
    const data = encoder.encode(password + salt)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  }

  async verifyPassword(password: string, hash: string): Promise<boolean> {
    const computed = await this.hashPassword(password)
    return computed === hash
  }

  async createToken(payload: Record<string, unknown>, options?: CreateTokenOptions): Promise<string> {
    const signer = new SignJWT(payload)
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()

    // expiresIn === null -> token perpetuo (integración, revocable vía DB).
    // undefined -> TTL por defecto (sesiones de usuario). valor -> explícito.
    if (options?.expiresIn === null) {
      // no seteamos exp
    } else if (options?.expiresIn !== undefined) {
      signer.setExpirationTime(options.expiresIn)
    } else {
      signer.setExpirationTime(`${this.tokenTTL}s`)
    }

    return signer.sign(this.secret)
  }

  async verifyToken(token: string): Promise<Record<string, unknown> | null> {
    try {
      const { payload } = await jwtVerify(token, this.secret)
      return payload as Record<string, unknown>
    } catch {
      return null
    }
  }
}
