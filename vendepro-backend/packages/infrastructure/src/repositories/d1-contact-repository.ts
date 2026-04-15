import { Contact } from '@vendepro/core'
import type { ContactRepository, ContactFilters } from '@vendepro/core'

export class D1ContactRepository implements ContactRepository {
  constructor(private readonly db: D1Database) {}

  async findById(id: string, orgId: string): Promise<Contact | null> {
    const row = await this.db
      .prepare('SELECT * FROM contacts WHERE id = ? AND org_id = ?')
      .bind(id, orgId)
      .first() as any
    return row ? this.toEntity(row) : null
  }

  async findByOrg(orgId: string, filters?: ContactFilters): Promise<Contact[]> {
    let query = 'SELECT * FROM contacts WHERE org_id = ?'
    const binds: unknown[] = [orgId]

    if (filters?.agent_id) { query += ' AND agent_id = ?'; binds.push(filters.agent_id) }
    if (filters?.search) {
      query += ' AND (full_name LIKE ? OR phone LIKE ?)'
      binds.push(`%${filters.search}%`, `%${filters.search}%`)
    }
    query += ' ORDER BY full_name LIMIT 200'

    const rows = (await this.db.prepare(query).bind(...binds).all()).results as any[]
    return rows.map(r => this.toEntity(r))
  }

  async save(contact: Contact): Promise<void> {
    const o = contact.toObject()
    await this.db.prepare(`
      INSERT INTO contacts (id, org_id, full_name, phone, email, role, notes, agent_id, created_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET
        full_name=excluded.full_name, phone=excluded.phone, email=excluded.email,
        role=excluded.role, notes=excluded.notes, updated_at=excluded.updated_at
    `).bind(o.id, o.org_id, o.full_name, o.phone, o.email, o.role, o.notes, o.agent_id, o.created_at, o.updated_at).run()
  }

  async delete(id: string, orgId: string): Promise<void> {
    await this.db.prepare('DELETE FROM contacts WHERE id = ? AND org_id = ?').bind(id, orgId).run()
  }

  private toEntity(row: any): Contact {
    return Contact.create({
      id: row.id, org_id: row.org_id, full_name: row.full_name, phone: row.phone ?? null,
      email: row.email ?? null, role: row.role ?? null, notes: row.notes ?? null,
      agent_id: row.agent_id, created_at: row.created_at, updated_at: row.updated_at,
    })
  }
}
