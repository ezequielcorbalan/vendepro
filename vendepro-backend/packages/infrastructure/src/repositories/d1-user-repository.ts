import { User } from '@vendepro/core'
import type { UserRepository } from '@vendepro/core'

export class D1UserRepository implements UserRepository {
  constructor(private readonly db: D1Database) {}

  async findById(id: string, orgId: string): Promise<User | null> {
    const row = await this.db
      .prepare('SELECT * FROM users WHERE id = ? AND (org_id = ? OR org_id IS NULL)')
      .bind(id, orgId)
      .first() as any
    return row ? this.toEntity(row) : null
  }

  async findByEmail(email: string): Promise<User | null> {
    const row = await this.db
      .prepare('SELECT * FROM users WHERE email = ?')
      .bind(email.toLowerCase().trim())
      .first() as any
    return row ? this.toEntity(row) : null
  }

  async findByOrg(orgId: string): Promise<User[]> {
    const rows = (await this.db
      .prepare('SELECT * FROM users WHERE org_id = ? ORDER BY full_name')
      .bind(orgId)
      .all()).results as any[]
    return rows.map(r => this.toEntity(r))
  }

  async save(user: User): Promise<void> {
    const o = user.toObject()
    await this.db.prepare(`
      INSERT INTO users (id, email, password_hash, full_name, phone, photo_url, role, org_id, active, created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET
        email=excluded.email, password_hash=excluded.password_hash, full_name=excluded.full_name,
        phone=excluded.phone, photo_url=excluded.photo_url, role=excluded.role, active=excluded.active
    `).bind(o.id, o.email, o.password_hash, o.full_name, o.phone, o.photo_url, o.role, o.org_id, o.active, o.created_at).run()
  }

  async delete(id: string, orgId: string): Promise<void> {
    await this.db.prepare('UPDATE users SET active = 0 WHERE id = ? AND org_id = ?').bind(id, orgId).run()
  }

  private toEntity(row: any): User {
    return User.create({
      id: row.id, email: row.email, password_hash: row.password_hash ?? '',
      full_name: row.full_name, phone: row.phone ?? null, photo_url: row.photo_url ?? null,
      role: row.role, org_id: row.org_id ?? null, active: row.active ?? 1,
      created_at: row.created_at,
    })
  }
}
