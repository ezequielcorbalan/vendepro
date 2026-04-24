import { OrgVariable } from '@vendepro/core'
import type { OrgVariableRepository, OrgVariableNamespace } from '@vendepro/core'

export class D1OrgVariableRepository implements OrgVariableRepository {
  constructor(private readonly db: D1Database) {}

  async findById(id: string): Promise<OrgVariable | null> {
    const row = await this.db.prepare(`SELECT * FROM org_variables WHERE id = ?`).bind(id).first() as any
    return row ? this.toEntity(row) : null
  }

  async findByKey(orgId: string, key: string): Promise<OrgVariable | null> {
    const row = await this.db.prepare(`SELECT * FROM org_variables WHERE org_id = ? AND key = ?`).bind(orgId, key).first() as any
    return row ? this.toEntity(row) : null
  }

  async listByOrg(orgId: string, namespace?: OrgVariableNamespace): Promise<OrgVariable[]> {
    let q = `SELECT * FROM org_variables WHERE org_id = ?`
    const binds: unknown[] = [orgId]
    if (namespace) { q += ` AND namespace = ?`; binds.push(namespace) }
    q += ` ORDER BY namespace ASC, key ASC LIMIT 500`
    const rows = (await this.db.prepare(q).bind(...binds).all()).results as any[]
    return rows.map(r => this.toEntity(r))
  }

  async save(v: OrgVariable): Promise<void> {
    const o = v.toObject()
    await this.db.prepare(`
      INSERT INTO org_variables (id, org_id, key, value, value_type, label, namespace, is_system, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?)
      ON CONFLICT(org_id, key) DO UPDATE SET
        value=excluded.value, value_type=excluded.value_type,
        label=excluded.label, namespace=excluded.namespace, updated_at=excluded.updated_at
    `).bind(o.id, o.org_id, o.key, o.value, o.value_type, o.label, o.namespace, (o as any).is_system ? 1 : 0, o.updated_at).run()
  }

  async delete(id: string): Promise<void> {
    await this.db.prepare(`DELETE FROM org_variables WHERE id = ? AND is_system = 0`).bind(id).run()
  }

  async resolveKeys(orgId: string, keys: string[]): Promise<Record<string, OrgVariable>> {
    if (keys.length === 0) return {}
    const placeholders = keys.map(() => '?').join(',')
    const rows = (await this.db.prepare(
      `SELECT * FROM org_variables WHERE org_id = ? AND key IN (${placeholders})`,
    ).bind(orgId, ...keys).all()).results as any[]
    const map: Record<string, OrgVariable> = {}
    for (const r of rows) map[r.key] = this.toEntity(r)
    return map
  }

  private toEntity(row: any): OrgVariable {
    return OrgVariable.fromPersistence({
      id: row.id, org_id: row.org_id, key: row.key, value: row.value,
      value_type: row.value_type, label: row.label, namespace: row.namespace,
      is_system: !!row.is_system, updated_at: row.updated_at,
    })
  }
}
