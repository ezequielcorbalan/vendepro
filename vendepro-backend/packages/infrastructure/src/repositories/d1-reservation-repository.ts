import { Reservation } from '@vendepro/core'
import type { ReservationRepository, ReservationFilters } from '@vendepro/core'

export class D1ReservationRepository implements ReservationRepository {
  constructor(private readonly db: D1Database) {}

  async findById(id: string, orgId: string): Promise<Reservation | null> {
    const row = await this.db
      .prepare(`SELECT r.*, u.full_name as agent_name FROM reservations r LEFT JOIN users u ON r.agent_id = u.id WHERE r.id = ? AND r.org_id = ?`)
      .bind(id, orgId)
      .first() as any
    return row ? this.toEntity(row) : null
  }

  async findByOrg(orgId: string, filters?: ReservationFilters): Promise<Reservation[]> {
    let query = `SELECT r.*, u.full_name as agent_name FROM reservations r LEFT JOIN users u ON r.agent_id = u.id WHERE r.org_id = ?`
    const binds: unknown[] = [orgId]

    if (filters?.stage) { query += ' AND r.stage = ?'; binds.push(filters.stage) }
    if (filters?.agent_id) { query += ' AND r.agent_id = ?'; binds.push(filters.agent_id) }
    if (filters?.property_id) { query += ' AND r.property_id = ?'; binds.push(filters.property_id) }
    query += ' ORDER BY r.created_at DESC LIMIT 200'

    const rows = (await this.db.prepare(query).bind(...binds).all()).results as any[]
    return rows.map(r => this.toEntity(r))
  }

  async findActiveByProperty(propertyId: string, orgId: string): Promise<Reservation | null> {
    const row = await this.db
      .prepare(`SELECT r.*, u.full_name as agent_name FROM reservations r LEFT JOIN users u ON r.agent_id = u.id
        WHERE r.property_id = ? AND r.org_id = ? AND r.stage NOT IN ('cancelada', 'rechazada')
        ORDER BY r.created_at DESC LIMIT 1`)
      .bind(propertyId, orgId)
      .first() as any
    return row ? this.toEntity(row) : null
  }

  async save(reservation: Reservation): Promise<void> {
    const o = reservation.toObject()
    await this.db.prepare(`
      INSERT INTO reservations (id, org_id, property_address, buyer_name, seller_name, agent_id,
        offer_amount, offer_currency, reservation_date, stage, notes,
        property_id, acceptance_deadline, accepted_at, boleto_date, escritura_date, delivery_date,
        created_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET
        property_address=excluded.property_address, buyer_name=excluded.buyer_name,
        seller_name=excluded.seller_name, offer_amount=excluded.offer_amount,
        offer_currency=excluded.offer_currency, reservation_date=excluded.reservation_date,
        stage=excluded.stage, notes=excluded.notes,
        property_id=excluded.property_id, acceptance_deadline=excluded.acceptance_deadline,
        accepted_at=excluded.accepted_at, boleto_date=excluded.boleto_date,
        escritura_date=excluded.escritura_date, delivery_date=excluded.delivery_date,
        updated_at=excluded.updated_at
    `).bind(
      o.id, o.org_id, o.property_address, o.buyer_name, o.seller_name, o.agent_id,
      o.offer_amount, o.offer_currency, o.reservation_date, o.stage, o.notes,
      o.property_id ?? null, o.acceptance_deadline ?? null, o.accepted_at ?? null,
      o.boleto_date ?? null, o.escritura_date ?? null, o.delivery_date ?? null,
      o.created_at, o.updated_at
    ).run()
  }

  async delete(id: string, orgId: string): Promise<void> {
    await this.db.prepare('DELETE FROM reservations WHERE id = ? AND org_id = ?').bind(id, orgId).run()
  }

  private toEntity(row: any): Reservation {
    return Reservation.create({
      id: row.id, org_id: row.org_id, property_address: row.property_address ?? null,
      buyer_name: row.buyer_name ?? null, seller_name: row.seller_name ?? null,
      agent_id: row.agent_id, offer_amount: row.offer_amount ?? null,
      offer_currency: row.offer_currency ?? 'USD', reservation_date: row.reservation_date ?? null,
      stage: row.stage, notes: row.notes ?? null, agent_name: row.agent_name,
      property_id: row.property_id ?? null, acceptance_deadline: row.acceptance_deadline ?? null,
      accepted_at: row.accepted_at ?? null, boleto_date: row.boleto_date ?? null,
      escritura_date: row.escritura_date ?? null, delivery_date: row.delivery_date ?? null,
      created_at: row.created_at, updated_at: row.updated_at,
    })
  }
}
