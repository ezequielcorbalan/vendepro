import type { TimeBasedCandidateRepository } from '@vendepro/core'

/**
 * Candidatos de los triggers time-based. Cada query excluye las entidades que
 * ya tienen un run de esa automatización desde `notRunSince` (`''` como
 * centinela = desde siempre, scope 'once'), con una excepción: los saltados
 * por `rate_limited` pueden reintentar — ese skip significa "ahora no", no
 * "nunca". Sin este filtro, los mismos N candidatos viejos taponarían el
 * LIMIT en cada tick y los nuevos no entrarían jamás.
 *
 * Los timestamps se normalizan con datetime() en ambos lados: en la base
 * conviven filas con formato de datetime('now') ('YYYY-MM-DD HH:MM:SS') y
 * filas ISO con 'T'/'Z' escritas por el código — compararlas como string
 * cruzado da cualquier cosa.
 */
export class D1TimeBasedCandidateRepository implements TimeBasedCandidateRepository {
  constructor(private readonly db: D1Database) {}

  private static readonly NO_PRIOR_RUN = `NOT EXISTS (
    SELECT 1 FROM automation_runs r
    WHERE r.automation_id = ?2
      AND r.entity_id = base.id
      AND (r.skip_reason IS NULL OR r.skip_reason <> 'rate_limited')
      AND (?3 = '' OR datetime(r.created_at) >= datetime(?3))
  )`

  async findLeadsWithoutContact(
    orgId: string,
    automationId: string,
    notRunSince: string | null,
    hours: number,
    now: Date,
    limit: number,
  ): Promise<string[]> {
    const cutoff = new Date(now.getTime() - hours * 3_600_000).toISOString()
    const rows = ((await this.db
      .prepare(`
        SELECT base.id FROM leads base
        WHERE base.org_id = ?1
          AND base.stage IN ('nuevo', 'asignado')
          AND datetime(base.created_at) <= datetime(?4)
          AND ${D1TimeBasedCandidateRepository.NO_PRIOR_RUN}
        ORDER BY base.created_at ASC
        LIMIT ?5
      `)
      .bind(orgId, automationId, notRunSince ?? '', cutoff, limit)
      .all()).results ?? []) as any[]
    return rows.map((r) => String(r.id))
  }

  async findLeadsWithoutActivity(
    orgId: string,
    automationId: string,
    notRunSince: string | null,
    days: number,
    now: Date,
    limit: number,
  ): Promise<string[]> {
    const cutoff = new Date(now.getTime() - days * 86_400_000).toISOString()
    const rows = ((await this.db
      .prepare(`
        SELECT base.id FROM leads base
        WHERE base.org_id = ?1
          AND base.stage NOT IN ('captado', 'perdido', 'finalizado', 'archivado')
          AND datetime(base.created_at) <= datetime(?4)
          AND NOT EXISTS (
            SELECT 1 FROM activities a
            WHERE a.lead_id = base.id AND datetime(a.created_at) > datetime(?4)
          )
          AND ${D1TimeBasedCandidateRepository.NO_PRIOR_RUN}
        ORDER BY base.created_at ASC
        LIMIT ?5
      `)
      .bind(orgId, automationId, notRunSince ?? '', cutoff, limit)
      .all()).results ?? []) as any[]
    return rows.map((r) => String(r.id))
  }

  async findPropertiesWithExpiringAuthorization(
    orgId: string,
    automationId: string,
    notRunSince: string | null,
    daysAhead: number,
    now: Date,
    limit: number,
  ): Promise<string[]> {
    // "Vence la publicación" = vence el mandato: auth_start_date + auth_duration_days
    // (default 180, el mismo del alta de propiedad). Una ya vencida no dispara:
    // el aviso es "por vencer", no "vencida".
    const today = now.toISOString().slice(0, 10)
    const rows = ((await this.db
      .prepare(`
        SELECT base.id FROM properties base
        WHERE base.org_id = ?1
          AND base.status = 'active'
          AND base.auth_start_date IS NOT NULL AND base.auth_start_date != ''
          AND date(base.auth_start_date, '+' || COALESCE(base.auth_duration_days, 180) || ' days') >= date(?4)
          AND date(base.auth_start_date, '+' || COALESCE(base.auth_duration_days, 180) || ' days') <= date(?4, '+' || CAST(?5 AS INTEGER) || ' days')
          AND ${D1TimeBasedCandidateRepository.NO_PRIOR_RUN}
        ORDER BY base.auth_start_date ASC
        LIMIT ?6
      `)
      .bind(orgId, automationId, notRunSince ?? '', today, daysAhead, limit)
      .all()).results ?? []) as any[]
    return rows.map((r) => String(r.id))
  }
}
