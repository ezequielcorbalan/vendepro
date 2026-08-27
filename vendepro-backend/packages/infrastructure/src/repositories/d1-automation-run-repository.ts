import { AutomationRun, AutomationRunAction } from '@vendepro/core'
import type {
  AutomationRunRepository,
  RunListFilters,
  RunStats,
} from '@vendepro/core'

export class D1AutomationRunRepository implements AutomationRunRepository {
  constructor(private readonly db: D1Database) {}

  async save(run: AutomationRun): Promise<void> {
    const o = run.toObject()
    await this.db.prepare(`
      INSERT INTO automation_runs (id, org_id, automation_id, trigger_event, entity_type,
        entity_id, status, skip_reason, payload, depth, dedupe_key, started_at, finished_at, created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET
        status=excluded.status, skip_reason=excluded.skip_reason, finished_at=excluded.finished_at
    `).bind(
      o.id, o.org_id, o.automation_id, o.trigger_event, o.entity_type, o.entity_id,
      o.status, o.skip_reason, o.payload ? JSON.stringify(o.payload) : null,
      o.depth, o.dedupe_key, o.started_at, o.finished_at, o.created_at,
    ).run()
  }

  /**
   * Inserta reservando la `dedupe_key`. La exclusividad la garantiza el índice
   * único parcial, no un SELECT previo: dos requests simultáneos sobre el mismo
   * lead no pueden ganar los dos.
   */
  async claim(run: AutomationRun): Promise<boolean> {
    const o = run.toObject()
    try {
      const result = await this.db.prepare(`
        INSERT OR IGNORE INTO automation_runs (id, org_id, automation_id, trigger_event, entity_type,
          entity_id, status, skip_reason, payload, depth, dedupe_key, started_at, finished_at, created_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      `).bind(
        o.id, o.org_id, o.automation_id, o.trigger_event, o.entity_type, o.entity_id,
        o.status, o.skip_reason, o.payload ? JSON.stringify(o.payload) : null,
        o.depth, o.dedupe_key, o.started_at, o.finished_at, o.created_at,
      ).run()
      return (result.meta?.changes ?? 0) > 0
    } catch {
      // Choque contra el índice único: ya corrió hoy sobre esta entidad.
      return false
    }
  }

  async findById(id: string, orgId: string): Promise<AutomationRun | null> {
    const row = (await this.db
      .prepare('SELECT * FROM automation_runs WHERE id = ? AND org_id = ?')
      .bind(id, orgId)
      .first()) as any
    return row ? toRun(row) : null
  }

  async findByOrg(orgId: string, filters: RunListFilters = {}): Promise<AutomationRun[]> {
    const where = ['org_id = ?']
    const binds: unknown[] = [orgId]
    if (filters.automationId) { where.push('automation_id = ?'); binds.push(filters.automationId) }
    if (filters.status) { where.push('status = ?'); binds.push(filters.status) }
    if (filters.entityId) { where.push('entity_id = ?'); binds.push(filters.entityId) }
    binds.push(Math.min(filters.limit ?? 50, 200))

    const rows = ((await this.db
      .prepare(`SELECT * FROM automation_runs WHERE ${where.join(' AND ')} ORDER BY created_at DESC LIMIT ?`)
      .bind(...binds)
      .all()).results ?? []) as any[]
    return rows.map(toRun)
  }

  async statsByOrg(orgId: string): Promise<RunStats[]> {
    const rows = ((await this.db.prepare(`
      SELECT automation_id,
             COUNT(*) AS total,
             SUM(CASE WHEN status IN ('success','partial') THEN 1 ELSE 0 END) AS success,
             SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed,
             SUM(CASE WHEN status = 'skipped' THEN 1 ELSE 0 END) AS skipped,
             MAX(created_at) AS last_run_at
      FROM automation_runs WHERE org_id = ? GROUP BY automation_id
    `).bind(orgId).all()).results ?? []) as any[]

    return rows.map((r) => ({
      automation_id: r.automation_id,
      total: Number(r.total ?? 0),
      success: Number(r.success ?? 0),
      failed: Number(r.failed ?? 0),
      skipped: Number(r.skipped ?? 0),
      last_run_at: r.last_run_at ?? null,
    }))
  }

  async countSince(orgId: string, since: string): Promise<number> {
    const row = (await this.db
      .prepare('SELECT COUNT(*) AS n FROM automation_runs WHERE org_id = ? AND created_at >= ?')
      .bind(orgId, since)
      .first()) as any
    return Number(row?.n ?? 0)
  }

  async saveAction(action: AutomationRunAction): Promise<void> {
    const o = action.toObject()
    await this.db.prepare(`
      INSERT INTO automation_run_actions (id, run_id, org_id, action_id, action_type,
        status, result, error, executed_at, created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET
        status=excluded.status, result=excluded.result, error=excluded.error,
        executed_at=excluded.executed_at
    `).bind(
      o.id, o.run_id, o.org_id, o.action_id, o.action_type, o.status,
      o.result ? JSON.stringify(o.result) : null, o.error, o.executed_at, o.created_at,
    ).run()
  }

  async findActionsByRun(runId: string): Promise<AutomationRunAction[]> {
    const rows = ((await this.db
      .prepare('SELECT * FROM automation_run_actions WHERE run_id = ? ORDER BY created_at')
      .bind(runId)
      .all()).results ?? []) as any[]
    return rows.map(toRunAction)
  }
}

function toRun(row: any): AutomationRun {
  return AutomationRun.create({
    id: row.id,
    org_id: row.org_id,
    automation_id: row.automation_id,
    trigger_event: row.trigger_event,
    entity_type: row.entity_type ?? null,
    entity_id: row.entity_id ?? null,
    status: row.status,
    skip_reason: row.skip_reason ?? null,
    payload: parseJson(row.payload),
    depth: row.depth ?? 0,
    dedupe_key: row.dedupe_key ?? null,
    started_at: row.started_at,
    finished_at: row.finished_at ?? null,
    created_at: row.created_at,
  })
}

function toRunAction(row: any): AutomationRunAction {
  return AutomationRunAction.create({
    id: row.id,
    run_id: row.run_id,
    org_id: row.org_id,
    action_id: row.action_id,
    action_type: row.action_type,
    status: row.status,
    result: parseJson(row.result),
    error: row.error ?? null,
    executed_at: row.executed_at ?? null,
    created_at: row.created_at,
  })
}

/** Un JSON corrupto en la base no debe romper la lectura del log. */
function parseJson(raw: unknown): Record<string, unknown> | null {
  if (typeof raw !== 'string' || raw.trim().length === 0) return null
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}
