import { AutomationJob } from '@vendepro/core'
import type { AutomationJobRepository } from '@vendepro/core'

export class D1AutomationJobRepository implements AutomationJobRepository {
  constructor(private readonly db: D1Database) {}

  async save(job: AutomationJob): Promise<void> {
    await this.statement(job).run()
  }

  async saveMany(jobs: readonly AutomationJob[]): Promise<void> {
    if (jobs.length === 0) return
    await this.db.batch(jobs.map((job) => this.statement(job)))
  }

  async findById(id: string): Promise<AutomationJob | null> {
    const row = (await this.db
      .prepare('SELECT * FROM automation_jobs WHERE id = ?')
      .bind(id)
      .first()) as any
    return row ? toJob(row) : null
  }

  /**
   * Vencidos y libres. Se incluyen los 'running' cuyo lease expiró: son jobs
   * de un worker que se murió a mitad de camino y hay que recuperar.
   */
  async findDue(limit: number, orgId?: string): Promise<AutomationJob[]> {
    const now = new Date().toISOString()
    const where = [
      `(status = 'pending' OR (status = 'running' AND locked_until IS NOT NULL AND locked_until < ?))`,
      'run_at <= ?',
    ]
    const binds: unknown[] = [now, now]
    if (orgId) { where.push('org_id = ?'); binds.push(orgId) }
    binds.push(Math.min(limit, 100))

    const rows = ((await this.db
      .prepare(`SELECT * FROM automation_jobs WHERE ${where.join(' AND ')} ORDER BY run_at ASC LIMIT ?`)
      .bind(...binds)
      .all()).results ?? []) as any[]
    return rows.map(toJob)
  }

  async countPendingByRun(runId: string): Promise<number> {
    const row = (await this.db
      .prepare(`SELECT COUNT(*) AS n FROM automation_jobs WHERE run_id = ? AND status IN ('pending','running')`)
      .bind(runId)
      .first()) as any
    return Number(row?.n ?? 0)
  }

  async cancelPendingByAutomation(automationId: string, reason: string): Promise<number> {
    const result = await this.db.prepare(`
      UPDATE automation_jobs
      SET status = 'cancelled', last_error = ?, locked_until = NULL, updated_at = datetime('now')
      WHERE automation_id = ? AND status = 'pending'
    `).bind(reason, automationId).run()
    return result.meta?.changes ?? 0
  }

  private statement(job: AutomationJob): D1PreparedStatement {
    const o = job.toObject()
    return this.db.prepare(`
      INSERT INTO automation_jobs (id, org_id, run_id, run_action_id, automation_id,
        action_id, action_type, context, action_config, run_at, status, attempts,
        last_error, locked_until, created_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET
        run_at=excluded.run_at, status=excluded.status, attempts=excluded.attempts,
        last_error=excluded.last_error, locked_until=excluded.locked_until,
        updated_at=excluded.updated_at
    `).bind(
      o.id, o.org_id, o.run_id, o.run_action_id, o.automation_id,
      o.action_id, o.action_type, JSON.stringify(o.context), JSON.stringify(o.action_config),
      o.run_at, o.status, o.attempts, o.last_error, o.locked_until, o.created_at, o.updated_at,
    )
  }
}

function toJob(row: any): AutomationJob {
  return AutomationJob.create({
    id: row.id,
    org_id: row.org_id,
    run_id: row.run_id,
    run_action_id: row.run_action_id,
    automation_id: row.automation_id,
    action_id: row.action_id,
    action_type: row.action_type,
    context: parseJson(row.context),
    action_config: parseJson(row.action_config),
    run_at: row.run_at,
    status: row.status,
    attempts: row.attempts ?? 0,
    last_error: row.last_error ?? null,
    locked_until: row.locked_until ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  })
}

function parseJson(raw: unknown): Record<string, unknown> {
  if (typeof raw !== 'string' || raw.trim().length === 0) return {}
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch {
    return {}
  }
}
