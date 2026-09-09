import { PortalSpend } from '@vendepro/core'
import type { PortalSpendRepository, PortalLeadCountRepository, PortalLeadCount } from '@vendepro/core'

export class D1PortalSpendRepository implements PortalSpendRepository {
  constructor(private readonly db: D1Database) {}

  async findByOrg(orgId: string, opts?: { fromMonth?: string; toMonth?: string; ownerUserId?: string }): Promise<PortalSpend[]> {
    const where: string[] = ['org_id = ?']
    const args: unknown[] = [orgId]
    if (opts?.fromMonth) { where.push('period_month >= ?'); args.push(opts.fromMonth) }
    if (opts?.toMonth) { where.push('period_month <= ?'); args.push(opts.toMonth) }
    // Marketing por usuario: el agente ve su presupuesto. Las filas viejas sin
    // dueño (cargadas antes de la migración 054) entran igual, porque son gasto
    // de la inmobiliaria que todavía nadie reclamó.
    if (opts?.ownerUserId) {
      where.push('(owner_user_id = ? OR owner_user_id IS NULL)')
      args.push(opts.ownerUserId)
    }

    const rows = (await this.db
      .prepare(`SELECT * FROM portal_spend WHERE ${where.join(' AND ')} ORDER BY period_month DESC, provider`)
      .bind(...args)
      .all()).results as any[]
    return rows.map(r => this.toEntity(r))
  }

  async findById(id: string, orgId: string): Promise<PortalSpend | null> {
    const row = await this.db
      .prepare('SELECT * FROM portal_spend WHERE id = ? AND org_id = ?')
      .bind(id, orgId)
      .first() as any
    return row ? this.toEntity(row) : null
  }

  /**
   * Upsert por (org, portal, mes) y no por id: cargar dos veces el gasto de
   * septiembre de ZonaProp tiene que corregir la fila, no duplicarla. El id
   * viaja igual para las altas.
   */
  async save(spend: PortalSpend): Promise<void> {
    const o = spend.toObject()
    await this.db.prepare(`
      INSERT INTO portal_spend (
        id, org_id, owner_user_id, provider, provider_label, period_month,
        amount, currency, usd_rate, usd_rate_source, usd_rate_at,
        notes, created_by, created_at, updated_at
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(org_id, COALESCE(owner_user_id, ''), provider, period_month) DO UPDATE SET
        provider_label = excluded.provider_label,
        amount = excluded.amount,
        currency = excluded.currency,
        usd_rate = excluded.usd_rate,
        usd_rate_source = excluded.usd_rate_source,
        usd_rate_at = excluded.usd_rate_at,
        notes = excluded.notes,
        updated_at = excluded.updated_at
    `).bind(
      o.id, o.org_id, o.owner_user_id, o.provider, o.provider_label, o.period_month,
      o.amount, o.currency, o.usd_rate, o.usd_rate_source, o.usd_rate_at,
      o.notes, o.created_by, o.created_at, o.updated_at,
    ).run()
  }

  async delete(id: string, orgId: string): Promise<void> {
    await this.db.prepare('DELETE FROM portal_spend WHERE id = ? AND org_id = ?').bind(id, orgId).run()
  }

  private toEntity(row: any): PortalSpend {
    return PortalSpend.create({
      id: row.id,
      org_id: row.org_id,
      owner_user_id: row.owner_user_id ?? null,
      provider: row.provider,
      provider_label: row.provider_label ?? null,
      period_month: row.period_month,
      amount: row.amount,
      currency: row.currency,
      usd_rate: row.usd_rate ?? null,
      usd_rate_source: row.usd_rate_source ?? null,
      usd_rate_at: row.usd_rate_at ?? null,
      notes: row.notes ?? null,
      created_by: row.created_by ?? null,
      created_at: row.created_at,
      updated_at: row.updated_at,
    })
  }
}

/** Etapas del pipeline comprador que implican que el lead llegó a una visita. */
const VISITED_STAGES = ['visita_agendada', 'visito', 'oferta', 'cerrado']

export class D1PortalLeadCountRepository implements PortalLeadCountRepository {
  constructor(private readonly db: D1Database) {}

  /**
   * Leads compradores por fuente en el rango [from, to). Los límites son
   * fechas `YYYY-MM-DD` porque `created_at` convive en dos formatos y sólo la
   * comparación por día ordena bien en los dos.
   */
  async countBuyerLeadsBySource(orgId: string, from: string, to: string, ownerUserId?: string): Promise<PortalLeadCount[]> {
    const placeholders = VISITED_STAGES.map(() => '?').join(',')
    // Marketing por usuario: el agente cruza su gasto contra SUS leads.
    const scope = ownerUserId ? ' AND assigned_to = ?' : ''
    const rows = (await this.db.prepare(`
      SELECT
        lower(source) AS provider,
        COUNT(*) AS leads,
        SUM(CASE WHEN stage IN (${placeholders}) THEN 1 ELSE 0 END) AS visitas,
        SUM(CASE WHEN stage = 'cerrado' THEN 1 ELSE 0 END) AS ganados
      FROM leads
      WHERE org_id = ?
        AND COALESCE(pipeline, 'vendedor') = 'comprador'
        AND created_at >= ? AND created_at < ?
        AND source IS NOT NULL AND source != ''${scope}
      GROUP BY provider
    `).bind(...VISITED_STAGES, orgId, from, to, ...(ownerUserId ? [ownerUserId] : [])).all()).results as any[]

    return rows.map(r => ({
      provider: r.provider,
      leads: Number(r.leads) || 0,
      visitas: Number(r.visitas) || 0,
      ganados: Number(r.ganados) || 0,
    }))
  }
}
