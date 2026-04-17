import { PasswordResetToken } from '@vendepro/core'
import type { PasswordResetTokenRepository } from '@vendepro/core'

export class D1PasswordResetTokenRepository implements PasswordResetTokenRepository {
  constructor(private readonly db: D1Database) {}

  async save(token: PasswordResetToken): Promise<void> {
    const o = token.toObject()
    await this.db
      .prepare(
        `INSERT INTO password_reset_tokens (token, user_id, org_id, expires_at, used, created_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(token) DO UPDATE SET
           user_id = excluded.user_id,
           org_id = excluded.org_id,
           expires_at = excluded.expires_at,
           used = excluded.used`,
      )
      .bind(
        o.token,
        o.user_id,
        o.org_id,
        o.expires_at,
        o.used ? 1 : 0,
        o.created_at,
      )
      .run()
  }

  async findByToken(token: string): Promise<PasswordResetToken | null> {
    const row = (await this.db
      .prepare('SELECT * FROM password_reset_tokens WHERE token = ?')
      .bind(token)
      .first()) as any
    if (!row) return null
    return PasswordResetToken.create({
      token: row.token,
      user_id: row.user_id,
      org_id: row.org_id,
      expires_at: row.expires_at,
      used: row.used === 1 || row.used === true,
      created_at: row.created_at,
    })
  }

  async markUsed(token: string): Promise<void> {
    await this.db
      .prepare('UPDATE password_reset_tokens SET used = 1 WHERE token = ?')
      .bind(token)
      .run()
  }

  async deleteExpired(now: Date = new Date()): Promise<number> {
    const result = await this.db
      .prepare('DELETE FROM password_reset_tokens WHERE expires_at < ?')
      .bind(now.toISOString())
      .run()
    return result.meta.changes ?? 0
  }
}
