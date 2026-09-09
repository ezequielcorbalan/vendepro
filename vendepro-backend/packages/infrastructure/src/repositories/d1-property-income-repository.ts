import type {
  PropertyIncomeRepository,
  SavePropertyIncomeInput,
  PropertyIncomeRow,
} from '@vendepro/core'

export class D1PropertyIncomeRepository implements PropertyIncomeRepository {
  constructor(private readonly db: D1Database) {}

  async saveIncome(input: SavePropertyIncomeInput): Promise<void> {
    // `sold_price` y `sold_date` se pisan sólo si vinieron: cargar los
    // honorarios de una venta ya registrada no tiene por qué tocar el precio.
    await this.db.prepare(`
      UPDATE properties SET
        commission_amount = ?,
        commission_currency = ?,
        commission_usd_rate = ?,
        commission_usd_rate_source = ?,
        commission_usd_rate_at = ?,
        income_at = ?,
        sold_price = COALESCE(?, sold_price),
        sold_date = COALESCE(?, sold_date),
        updated_at = datetime('now')
      WHERE id = ? AND org_id = ?
    `).bind(
      input.commissionAmount,
      input.commissionCurrency,
      input.commissionUsdRate,
      input.commissionUsdRateSource,
      input.commissionUsdRateAt,
      input.incomeAt,
      input.soldPrice ?? null,
      input.soldDate ?? null,
      input.propertyId,
      input.orgId,
    ).run()
  }

  /**
   * El comprador al que se le atribuye la operación es **uno solo por
   * propiedad**: el lead comprador cerrado más antiguo de esa propiedad. Sin
   * ese `LIMIT 1`, una propiedad con dos compradores marcados como cerrados
   * sumaría los honorarios dos veces y el ROI del portal saldría al doble.
   */
  async findIncomeByBuyerSource(orgId: string, from: string, to: string, ownerUserId?: string): Promise<PropertyIncomeRow[]> {
    // Marketing por usuario: el ROI de un agente sale de SUS propiedades.
    const scope = ownerUserId ? ' AND p.agent_id = ?' : ''
    const rows = (await this.db.prepare(`
      SELECT
        p.id AS property_id,
        p.commission_amount,
        p.commission_currency,
        p.commission_usd_rate,
        (
          SELECT lower(l.source)
          FROM lead_properties lp
          JOIN leads l ON l.id = lp.lead_id AND l.org_id = lp.org_id
          WHERE lp.property_id = p.id
            AND lp.org_id = p.org_id
            AND COALESCE(l.pipeline, 'vendedor') = 'comprador'
            AND l.stage = 'cerrado'
            AND l.source IS NOT NULL AND l.source != ''
          ORDER BY l.created_at ASC
          LIMIT 1
        ) AS attribution
      FROM properties p
      WHERE p.org_id = ?
        AND p.commission_amount IS NOT NULL
        AND p.income_at IS NOT NULL
        AND p.income_at >= ? AND p.income_at < ?${scope}
    `).bind(orgId, from, to, ...(ownerUserId ? [ownerUserId] : [])).all()).results as any[]

    return rows.map(r => ({
      property_id: r.property_id,
      attribution: r.attribution ?? null,
      commission_amount: r.commission_amount ?? null,
      commission_currency: r.commission_currency ?? null,
      commission_usd_rate: r.commission_usd_rate ?? null,
    }))
  }

  /**
   * La atribución de captación sale del lead que originó la propiedad
   * (`properties.lead_id`, migración 004): su `source_detail` es la campaña.
   *
   * Es el mismo match por texto que usa el resto de la tabla de campañas, con
   * su misma fragilidad: si renombran la campaña en Ads Manager, la fila deja
   * de matchear. Se mantiene igual a propósito — tener dos criterios distintos
   * de atribución en la misma pantalla sería peor.
   */
  async findIncomeByCaptureCampaign(orgId: string, from: string, to: string, ownerUserId?: string): Promise<PropertyIncomeRow[]> {
    const scope = ownerUserId ? ' AND p.agent_id = ?' : ''
    const rows = (await this.db.prepare(`
      SELECT
        p.id AS property_id,
        p.commission_amount,
        p.commission_currency,
        p.commission_usd_rate,
        lower(l.source_detail) AS attribution
      FROM properties p
      LEFT JOIN leads l
        ON l.id = p.lead_id
       AND l.org_id = p.org_id
       AND COALESCE(l.pipeline, 'vendedor') = 'vendedor'
       AND l.source_detail IS NOT NULL AND l.source_detail != ''
      WHERE p.org_id = ?
        AND p.commission_amount IS NOT NULL
        AND p.income_at IS NOT NULL
        AND p.income_at >= ? AND p.income_at < ?${scope}
    `).bind(orgId, from, to, ...(ownerUserId ? [ownerUserId] : [])).all()).results as any[]

    return rows.map(r => ({
      property_id: r.property_id,
      attribution: r.attribution ?? null,
      commission_amount: r.commission_amount ?? null,
      commission_currency: r.commission_currency ?? null,
      commission_usd_rate: r.commission_usd_rate ?? null,
    }))
  }
}
