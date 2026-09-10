import type { AutomationSweepRepository, SweepCandidateQuery } from '@vendepro/core'

/**
 * Queries de candidatos del barrido por tiempo.
 *
 * Todas comparten el filtro anti-re-disparo: NOT EXISTS sobre automation_runs
 * para (automation_id, entity_id) desde `notRunSince` (o desde siempre, si es
 * null — se bindea '' como centinela). Los timestamps se normalizan con
 * datetime() en ambos lados porque en la base conviven filas con el formato
 * de datetime('now') ('YYYY-MM-DD HH:MM:SS') y filas ISO con 'T'/'Z'.
 */
export class D1AutomationSweepRepository implements AutomationSweepRepository {
  constructor(private readonly db: D1Database) {}

  async leadsSinContacto(q: SweepCandidateQuery & { createdBefore: string }): Promise<string[]> {
    // "Sin contactar" = sigue en las etapas previas a 'contactado'.
    const rows = ((await this.db
      .prepare(`
        SELECT l.id FROM leads l
        WHERE l.org_id = ?
          AND l.stage IN ('nuevo', 'asignado')
          AND datetime(l.created_at) <= datetime(?)
          AND NOT EXISTS (
            SELECT 1 FROM automation_runs r
            WHERE r.automation_id = ? AND r.entity_id = l.id
              AND (? = '' OR r.created_at >= ?)
          )
        ORDER BY l.created_at ASC
        LIMIT ?
      `)
      .bind(q.orgId, q.createdBefore, q.automationId, q.notRunSince ?? '', q.notRunSince ?? '', q.limit)
      .all()).results ?? []) as any[]
    return rows.map((r) => r.id as string)
  }

  async leadsSinRespuesta(q: SweepCandidateQuery & { inactiveSince: string }): Promise<string[]> {
    // "Sin actividad" = ni una fila en activities desde el corte (o nunca:
    // COALESCE cae a created_at, así un lead viejo sin actividades cuenta).
    // Se excluyen los cerrados — un lead perdido no necesita seguimiento.
    const rows = ((await this.db
      .prepare(`
        SELECT l.id FROM leads l
        WHERE l.org_id = ?
          AND l.stage NOT IN ('captado', 'perdido', 'archivado', 'finalizado')
          AND datetime(l.created_at) <= datetime(?)
          AND datetime(COALESCE(
                (SELECT MAX(a.created_at) FROM activities a WHERE a.lead_id = l.id),
                l.created_at
              )) <= datetime(?)
          AND NOT EXISTS (
            SELECT 1 FROM automation_runs r
            WHERE r.automation_id = ? AND r.entity_id = l.id
              AND (? = '' OR r.created_at >= ?)
          )
        ORDER BY l.created_at ASC
        LIMIT ?
      `)
      .bind(
        q.orgId, q.inactiveSince, q.inactiveSince,
        q.automationId, q.notRunSince ?? '', q.notRunSince ?? '', q.limit,
      )
      .all()).results ?? []) as any[]
    return rows.map((r) => r.id as string)
  }

  async propiedadesPorVencer(q: SweepCandidateQuery & { hoy: string; diasAntes: number }): Promise<string[]> {
    // Vencimiento = auth_start_date + auth_duration_days (migración 013).
    // Candidata si vence dentro de la ventana [hoy, hoy + diasAntes]; una ya
    // vencida no dispara (el aviso es "por vencer", no "vencida").
    const rows = ((await this.db
      .prepare(`
        SELECT p.id FROM properties p
        WHERE p.org_id = ?
          AND p.status = 'active'
          AND p.auth_start_date IS NOT NULL AND p.auth_start_date != ''
          AND date(p.auth_start_date, '+' || COALESCE(p.auth_duration_days, 180) || ' days') >= date(?)
          AND date(p.auth_start_date, '+' || COALESCE(p.auth_duration_days, 180) || ' days')
              <= date(?, '+' || ? || ' days')
          AND NOT EXISTS (
            SELECT 1 FROM automation_runs r
            WHERE r.automation_id = ? AND r.entity_id = p.id
              AND (? = '' OR r.created_at >= ?)
          )
        LIMIT ?
      `)
      .bind(
        q.orgId, q.hoy, q.hoy, q.diasAntes,
        q.automationId, q.notRunSince ?? '', q.notRunSince ?? '', q.limit,
      )
      .all()).results ?? []) as any[]
    return rows.map((r) => r.id as string)
  }
}
