import { Automation, AutomationAction } from '@vendepro/core'
import type {
  AutomationRepository,
  AutomationWithActions,
} from '@vendepro/core'

export class D1AutomationRepository implements AutomationRepository {
  constructor(private readonly db: D1Database) {}

  async findById(id: string, orgId: string): Promise<AutomationWithActions | null> {
    // La receta de sistema (org_id NULL) también se puede leer por id: el
    // editor la muestra en modo lectura antes de activarla.
    const row = (await this.db
      .prepare('SELECT * FROM automations WHERE id = ? AND (org_id = ? OR (org_id IS NULL AND is_system = 1))')
      .bind(id, orgId)
      .first()) as any
    if (!row) return null
    return { automation: toAutomation(row), actions: await this.loadActions([row.id]) }
  }

  async findByOrg(orgId: string): Promise<AutomationWithActions[]> {
    const rows = ((await this.db
      .prepare('SELECT * FROM automations WHERE org_id = ? ORDER BY created_at DESC')
      .bind(orgId)
      .all()).results ?? []) as any[]
    return this.hydrate(rows)
  }

  async findActiveByTrigger(orgId: string, triggerType: string): Promise<AutomationWithActions[]> {
    const rows = ((await this.db
      .prepare('SELECT * FROM automations WHERE org_id = ? AND trigger_type = ? AND is_active = 1')
      .bind(orgId, triggerType)
      .all()).results ?? []) as any[]
    return this.hydrate(rows)
  }

  async findSystemCatalog(): Promise<AutomationWithActions[]> {
    const rows = ((await this.db
      .prepare('SELECT * FROM automations WHERE is_system = 1 AND org_id IS NULL ORDER BY name')
      .all()).results ?? []) as any[]
    return this.hydrate(rows)
  }

  async findSystemByTemplateKey(templateKey: string): Promise<AutomationWithActions | null> {
    const row = (await this.db
      .prepare('SELECT * FROM automations WHERE is_system = 1 AND org_id IS NULL AND template_key = ?')
      .bind(templateKey)
      .first()) as any
    if (!row) return null
    return { automation: toAutomation(row), actions: await this.loadActions([row.id]) }
  }

  async findActivatedTemplateKeys(orgId: string): Promise<string[]> {
    const rows = ((await this.db
      .prepare('SELECT template_key FROM automations WHERE org_id = ? AND template_key IS NOT NULL')
      .bind(orgId)
      .all()).results ?? []) as any[]
    return rows.map((r) => r.template_key as string)
  }

  async findActiveTimeBased(): Promise<AutomationWithActions[]> {
    // El barrido del cron es global: recorre todas las orgs.
    const rows = ((await this.db
      .prepare(`SELECT * FROM automations
                WHERE is_active = 1 AND org_id IS NOT NULL
                  AND trigger_type IN ('lead.sin_contacto_24h','lead.sin_respuesta_7d','property.publicacion_vencida')`)
      .all()).results ?? []) as any[]
    return this.hydrate(rows)
  }

  async save(automation: Automation, actions: readonly AutomationAction[]): Promise<void> {
    const o = automation.toObject()
    const statements: D1PreparedStatement[] = [
      this.db.prepare(`
        INSERT INTO automations (id, org_id, name, description, template_key, is_system,
          trigger_type, trigger_config, conditions, dedupe_scope, is_active, created_by, created_at, updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        ON CONFLICT(id) DO UPDATE SET
          name=excluded.name, description=excluded.description,
          trigger_type=excluded.trigger_type, trigger_config=excluded.trigger_config,
          conditions=excluded.conditions, dedupe_scope=excluded.dedupe_scope,
          is_active=excluded.is_active,
          updated_at=excluded.updated_at
      `).bind(
        o.id, o.org_id, o.name, o.description, o.template_key, o.is_system ? 1 : 0,
        o.trigger_type, JSON.stringify(o.trigger_config), JSON.stringify(o.conditions),
        o.dedupe_scope, o.is_active ? 1 : 0, o.created_by, o.created_at, o.updated_at,
      ),
      // Las acciones se reemplazan enteras: el editor manda siempre el set
      // completo y ordenado, así no quedan huérfanas al borrar una del medio.
      this.db.prepare('DELETE FROM automation_actions WHERE automation_id = ?').bind(o.id),
      ...actions.map((action) => {
        const a = action.toObject()
        return this.db.prepare(`
          INSERT INTO automation_actions (id, automation_id, org_id, order_index,
            action_type, action_config, delay_minutes, created_at, updated_at)
          VALUES (?,?,?,?,?,?,?,?,?)
        `).bind(
          a.id, a.automation_id, a.org_id, a.order_index,
          a.action_type, JSON.stringify(a.action_config), a.delay_minutes,
          a.created_at, a.updated_at,
        )
      }),
    ]
    await this.db.batch(statements)
  }

  async delete(id: string, orgId: string): Promise<void> {
    await this.db.batch([
      this.db.prepare('DELETE FROM automation_actions WHERE automation_id = ?').bind(id),
      this.db.prepare('DELETE FROM automations WHERE id = ? AND org_id = ?').bind(id, orgId),
    ])
  }

  async setActive(id: string, orgId: string, active: boolean): Promise<void> {
    await this.db
      .prepare(`UPDATE automations SET is_active = ?, updated_at = datetime('now') WHERE id = ? AND org_id = ?`)
      .bind(active ? 1 : 0, id, orgId)
      .run()
  }

  /** Carga las acciones de varias automatizaciones en una sola query (evita el N+1). */
  private async hydrate(rows: any[]): Promise<AutomationWithActions[]> {
    if (rows.length === 0) return []
    const actions = await this.loadActions(rows.map((r) => r.id))
    const byAutomation = new Map<string, AutomationAction[]>()
    for (const action of actions) {
      const list = byAutomation.get(action.automation_id) ?? []
      list.push(action)
      byAutomation.set(action.automation_id, list)
    }
    return rows.map((row) => ({
      automation: toAutomation(row),
      actions: byAutomation.get(row.id) ?? [],
    }))
  }

  private async loadActions(automationIds: string[]): Promise<AutomationAction[]> {
    if (automationIds.length === 0) return []
    const placeholders = automationIds.map(() => '?').join(',')
    const rows = ((await this.db
      .prepare(`SELECT * FROM automation_actions WHERE automation_id IN (${placeholders}) ORDER BY automation_id, order_index`)
      .bind(...automationIds)
      .all()).results ?? []) as any[]
    return rows.map(toAction)
  }
}

function toAutomation(row: any): Automation {
  return Automation.create({
    id: row.id,
    org_id: row.org_id ?? null,
    name: row.name,
    description: row.description ?? null,
    template_key: row.template_key ?? null,
    is_system: row.is_system === 1 || row.is_system === true,
    trigger_type: row.trigger_type,
    trigger_config: row.trigger_config ?? '{}',
    conditions: row.conditions ?? '[]',
    dedupe_scope: row.dedupe_scope ?? 'daily',
    is_active: row.is_active === 1 || row.is_active === true,
    created_by: row.created_by ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  })
}

function toAction(row: any): AutomationAction {
  return AutomationAction.create({
    id: row.id,
    automation_id: row.automation_id,
    org_id: row.org_id ?? null,
    order_index: row.order_index ?? 0,
    action_type: row.action_type,
    action_config: row.action_config ?? '{}',
    delay_minutes: row.delay_minutes ?? 0,
    created_at: row.created_at,
    updated_at: row.updated_at,
  })
}
