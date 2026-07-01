import { ApiToken } from '@vendepro/core'
import type { ApiTokenRepository } from '@vendepro/core'

export class D1ApiTokenRepository implements ApiTokenRepository {
  constructor(private readonly db: D1Database) {}

  async save(token: ApiToken): Promise<void> {
    const o = token.toObject()
    await this.db.prepare(`
      INSERT INTO api_tokens (id, org_id, name, scopes, prefix, created_by, is_active,
        last_used_at, revoked_at, created_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET
        name=excluded.name, scopes=excluded.scopes, is_active=excluded.is_active,
        last_used_at=excluded.last_used_at, revoked_at=excluded.revoked_at,
        updated_at=excluded.updated_at
    `).bind(
      o.id, o.org_id, o.name, o.scopes.join(','), o.prefix, o.created_by,
      o.is_active ? 1 : 0, o.last_used_at, o.revoked_at, o.created_at, o.updated_at,
    ).run()
  }

  async findById(id: string): Promise<ApiToken | null> {
    const row = await this.db
      .prepare('SELECT * FROM api_tokens WHERE id = ?')
      .bind(id)
      .first() as any
    return row ? this.toEntity(row) : null
  }

  async findByOrg(orgId: string): Promise<ApiToken[]> {
    const rows = (await this.db
      .prepare('SELECT * FROM api_tokens WHERE org_id = ? ORDER BY created_at DESC')
      .bind(orgId)
      .all()).results as any[]
    return rows.map((r) => this.toEntity(r))
  }

  async revoke(id: string, orgId: string): Promise<void> {
    await this.db
      .prepare(`UPDATE api_tokens SET is_active = 0, revoked_at = datetime('now'), updated_at = datetime('now') WHERE id = ? AND org_id = ?`)
      .bind(id, orgId)
      .run()
  }

  async touchLastUsed(id: string): Promise<void> {
    await this.db
      .prepare(`UPDATE api_tokens SET last_used_at = datetime('now') WHERE id = ?`)
      .bind(id)
      .run()
  }

  private toEntity(row: any): ApiToken {
    return ApiToken.create({
      id: row.id,
      org_id: row.org_id,
      name: row.name,
      scopes: typeof row.scopes === 'string' && row.scopes.length > 0 ? row.scopes.split(',') : [],
      prefix: row.prefix ?? null,
      created_by: row.created_by ?? null,
      is_active: row.is_active === 1 || row.is_active === true,
      last_used_at: row.last_used_at ?? null,
      revoked_at: row.revoked_at ?? null,
      created_at: row.created_at,
      updated_at: row.updated_at,
    })
  }
}
