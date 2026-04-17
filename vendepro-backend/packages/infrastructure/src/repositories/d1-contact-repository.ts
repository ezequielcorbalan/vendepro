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
      query += ' AND (full_name LIKE ? OR phone LIKE ? OR email LIKE ?)'
      binds.push(`%${filters.search}%`, `%${filters.search}%`, `%${filters.search}%`)
    }
    query += ' ORDER BY full_name LIMIT 200'

    const rows = (await this.db.prepare(query).bind(...binds).all()).results as any[]
    return rows.map(r => this.toEntity(r))
  }

  async findWithLeadsAndProperties(id: string, orgId: string): Promise<{
    contact: Contact
    leads: Array<{ id: string; full_name: string; stage: string }>
    properties: Array<{ id: string; address: string; status: string }>
  } | null> {
    const contactRow = await this.db
      .prepare('SELECT * FROM contacts WHERE id = ? AND org_id = ?')
      .bind(id, orgId)
      .first() as any
    if (!contactRow) return null

    const leadsRes = await this.db
      .prepare('SELECT id, full_name, stage FROM leads WHERE contact_id = ? AND org_id = ? ORDER BY created_at DESC')
      .bind(id, orgId)
      .all()
    const propsRes = await this.db
      .prepare('SELECT id, address, status FROM properties WHERE contact_id = ? AND org_id = ? ORDER BY created_at DESC')
      .bind(id, orgId)
      .all()

    const leads = (leadsRes.results as any[]).map(r => ({
      id: r.id,
      full_name: r.full_name,
      stage: r.stage,
    }))
    const properties = (propsRes.results as any[]).map(r => ({
      id: r.id,
      address: r.address,
      status: r.status,
    }))

    return { contact: this.toEntity(contactRow), leads, properties }
  }

  async save(contact: Contact): Promise<void> {
    const o = contact.toObject()
    await this.db.prepare(`
      INSERT INTO contacts (id, org_id, full_name, phone, email, contact_type, neighborhood, notes, source, agent_id, created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET
        full_name=excluded.full_name, phone=excluded.phone, email=excluded.email,
        contact_type=excluded.contact_type, neighborhood=excluded.neighborhood,
        notes=excluded.notes, source=excluded.source
    `).bind(
      o.id, o.org_id, o.full_name, o.phone, o.email,
      o.contact_type, o.neighborhood, o.notes, o.source,
      o.agent_id, o.created_at
    ).run()
  }

  async delete(id: string, orgId: string): Promise<void> {
    await this.db.prepare('DELETE FROM contacts WHERE id = ? AND org_id = ?').bind(id, orgId).run()
  }

  private toEntity(row: any): Contact {
    return Contact.create({
      id: row.id,
      org_id: row.org_id,
      full_name: row.full_name,
      phone: row.phone ?? null,
      email: row.email ?? null,
      contact_type: row.contact_type ?? 'propietario',
      neighborhood: row.neighborhood ?? null,
      notes: row.notes ?? null,
      source: row.source ?? null,
      agent_id: row.agent_id,
      created_at: row.created_at,
    })
  }
}
