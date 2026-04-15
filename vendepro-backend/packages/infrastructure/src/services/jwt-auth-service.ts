import { SignJWT, jwtVerify } from 'jose'
import type { AuthService } from '@vendepro/core'

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

  async createToken(payload: Record<string, unknown>): Promise<string> {
    return new SignJWT(payload)
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(`${this.tokenTTL}s`)
      .sign(this.secret)
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
