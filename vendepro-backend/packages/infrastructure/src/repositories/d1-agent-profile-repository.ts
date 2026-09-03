import { AgentProfile, type AgentProfileRow } from '@vendepro/core'
import type { AgentProfileRepository } from '@vendepro/core'

export class D1AgentProfileRepository implements AgentProfileRepository {
  constructor(private readonly db: D1Database) {}

  async findByUserId(userId: string): Promise<AgentProfile | null> {
    const row = await this.db
      .prepare('SELECT * FROM agent_profiles WHERE user_id = ?')
      .bind(userId)
      .first<AgentProfileRow>()
    return row ? AgentProfile.fromPersistence(row) : null
  }

  async findByOrgAndSlug(orgId: string, slug: string): Promise<AgentProfile | null> {
    const row = await this.db
      .prepare('SELECT * FROM agent_profiles WHERE org_id = ? AND slug = ?')
      .bind(orgId, slug)
      .first<AgentProfileRow>()
    return row ? AgentProfile.fromPersistence(row) : null
  }

  async existsSlug(orgId: string, slug: string, exceptUserId?: string): Promise<boolean> {
    const row = await this.db
      .prepare('SELECT 1 AS x FROM agent_profiles WHERE org_id = ? AND slug = ? AND user_id != ?')
      .bind(orgId, slug, exceptUserId ?? '')
      .first<{ x: number }>()
    return row !== null
  }

  async save(profile: AgentProfile): Promise<void> {
    const p = profile.toObject()
    await this.db
      .prepare(`
        INSERT INTO agent_profiles (
          user_id, org_id, slug, headline, bio, license, years_experience,
          zones_json, specialties_json, whatsapp, instagram, tiktok, youtube,
          linkedin, website, cover_image_url, stats_json, is_public,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET
          slug = excluded.slug,
          headline = excluded.headline,
          bio = excluded.bio,
          license = excluded.license,
          years_experience = excluded.years_experience,
          zones_json = excluded.zones_json,
          specialties_json = excluded.specialties_json,
          whatsapp = excluded.whatsapp,
          instagram = excluded.instagram,
          tiktok = excluded.tiktok,
          youtube = excluded.youtube,
          linkedin = excluded.linkedin,
          website = excluded.website,
          cover_image_url = excluded.cover_image_url,
          stats_json = excluded.stats_json,
          is_public = excluded.is_public,
          updated_at = excluded.updated_at
      `)
      .bind(
        p.user_id, p.org_id, p.slug, p.headline, p.bio, p.license, p.years_experience,
        JSON.stringify(p.zones), JSON.stringify(p.specialties), p.whatsapp, p.instagram,
        p.tiktok, p.youtube, p.linkedin, p.website, p.cover_image_url,
        JSON.stringify(p.stats), p.is_public ? 1 : 0, p.created_at, p.updated_at,
      )
      .run()
  }
}
