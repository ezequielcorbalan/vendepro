import { FichaLink } from '@vendepro/core'
import type { FichaLinkRepository, FichaLinkFilters, FichaLinkPrefill } from '@vendepro/core'

/** D1 adapter para `ficha_links` (migración 041). */
export class D1FichaLinkRepository implements FichaLinkRepository {
  constructor(private readonly db: D1Database) {}

  async findById(id: string, orgId: string): Promise<FichaLink | null> {
    const row = (await this.db
      .prepare('SELECT * FROM ficha_links WHERE id = ? AND org_id = ?')
      .bind(id, orgId)
      .first()) as any
    return row ? this.toEntity(row) : null
  }

  async findBySlug(slug: string): Promise<FichaLink | null> {
    const row = (await this.db
      .prepare('SELECT * FROM ficha_links WHERE slug = ?')
      .bind(slug)
      .first()) as any
    return row ? this.toEntity(row) : null
  }

  async existsBySlug(slug: string): Promise<boolean> {
    const row = (await this.db
      .prepare('SELECT 1 AS x FROM ficha_links WHERE slug = ?')
      .bind(slug)
      .first()) as any
    return !!row
  }

  async findByOrg(orgId: string, filters?: FichaLinkFilters): Promise<FichaLink[]> {
    const clauses: string[] = ['org_id = ?']
    const binds: any[] = [orgId]
    if (filters?.agent_id) { clauses.push('agent_id = ?'); binds.push(filters.agent_id) }
    if (filters?.lead_id) { clauses.push('lead_id = ?'); binds.push(filters.lead_id) }
    if (filters?.mode) { clauses.push('mode = ?'); binds.push(filters.mode) }
    if (!filters?.include_archived) clauses.push('archived_at IS NULL')

    const rows = (((await this.db
      .prepare(`SELECT * FROM ficha_links WHERE ${clauses.join(' AND ')} ORDER BY created_at DESC`)
      .bind(...binds)
      .all()).results) as any[]) || []
    return rows.map((r) => this.toEntity(r))
  }

  async findOpenLink(orgId: string, agentId: string | null): Promise<FichaLink | null> {
    // agent_id NULL identifica al link institucional, y `= NULL` nunca matchea
    // en SQL: hay que ramificar con IS NULL.
    const sql = agentId
      ? `SELECT * FROM ficha_links
         WHERE org_id = ? AND mode = 'open' AND agent_id = ?
           AND archived_at IS NULL AND active = 1
         ORDER BY created_at DESC LIMIT 1`
      : `SELECT * FROM ficha_links
         WHERE org_id = ? AND mode = 'open' AND agent_id IS NULL
           AND archived_at IS NULL AND active = 1
         ORDER BY created_at DESC LIMIT 1`
    const stmt = agentId
      ? this.db.prepare(sql).bind(orgId, agentId)
      : this.db.prepare(sql).bind(orgId)
    const row = (await stmt.first()) as any
    return row ? this.toEntity(row) : null
  }

  async save(link: FichaLink): Promise<void> {
    const o = link.toObject()
    await this.db
      .prepare(
        `INSERT INTO ficha_links (
          id, org_id, agent_id, mode, slug, label, lead_id, prefill_json,
          active, submissions_count, last_submitted_at, archived_at,
          created_at, updated_at
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        ON CONFLICT(id) DO UPDATE SET
          agent_id=excluded.agent_id,
          mode=excluded.mode,
          label=excluded.label,
          lead_id=excluded.lead_id,
          prefill_json=excluded.prefill_json,
          active=excluded.active,
          archived_at=excluded.archived_at,
          updated_at=excluded.updated_at`,
      )
      .bind(
        o.id,
        o.org_id,
        o.agent_id,
        o.mode,
        o.slug,
        o.label,
        o.lead_id,
        o.prefill ? JSON.stringify(o.prefill) : null,
        o.active ? 1 : 0,
        o.submissions_count,
        o.last_submitted_at,
        o.archived_at,
        o.created_at,
        o.updated_at,
      )
      .run()
  }

  async registerSubmission(id: string): Promise<void> {
    const now = new Date().toISOString()
    // Incremento atómico en SQL: dos propietarios enviando a la vez no se pisan.
    await this.db
      .prepare(
        `UPDATE ficha_links
         SET submissions_count = submissions_count + 1,
             last_submitted_at = ?,
             updated_at = ?
         WHERE id = ?`,
      )
      .bind(now, now, id)
      .run()
  }

  async setArchived(id: string, orgId: string, archived: boolean): Promise<void> {
    const now = new Date().toISOString()
    await this.db
      .prepare('UPDATE ficha_links SET archived_at = ?, updated_at = ? WHERE id = ? AND org_id = ?')
      .bind(archived ? now : null, now, id, orgId)
      .run()
  }

  async delete(id: string, orgId: string): Promise<void> {
    await this.db
      .prepare('DELETE FROM ficha_links WHERE id = ? AND org_id = ?')
      .bind(id, orgId)
      .run()
  }

  private toEntity(row: any): FichaLink {
    let prefill: FichaLinkPrefill | null = null
    if (row.prefill_json) {
      // Un JSON corrupto no debe tumbar el link: se sirve sin pre-llenado.
      try { prefill = JSON.parse(row.prefill_json) } catch { prefill = null }
    }
    return FichaLink.create({
      id: row.id,
      org_id: row.org_id,
      agent_id: row.agent_id ?? null,
      mode: row.mode,
      slug: row.slug,
      label: row.label ?? null,
      lead_id: row.lead_id ?? null,
      prefill,
      active: row.active !== 0,
      submissions_count: row.submissions_count ?? 0,
      last_submitted_at: row.last_submitted_at ?? null,
      archived_at: row.archived_at ?? null,
      created_at: row.created_at,
      updated_at: row.updated_at,
    })
  }
}
