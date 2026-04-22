import { PropertyVisitForm } from '@vendepro/core'
import type {
  PropertyVisitFormRepository,
  PropertyVisitFormWithContext,
  BuyIntention,
} from '@vendepro/core'

export class D1PropertyVisitFormRepository implements PropertyVisitFormRepository {
  constructor(private readonly db: D1Database) {}

  async save(form: PropertyVisitForm): Promise<void> {
    const o = form.toObject()
    await this.db
      .prepare(
        `INSERT INTO property_visit_forms (
           id, org_id, property_id, agent_id, slug,
           visitor_name, visitor_email, visitor_phone,
           liked, disliked, subjective_price_usd, buy_intention, observations,
           submitted_at, sent_at, created_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           visitor_name = excluded.visitor_name,
           visitor_email = excluded.visitor_email,
           visitor_phone = excluded.visitor_phone,
           liked = excluded.liked,
           disliked = excluded.disliked,
           subjective_price_usd = excluded.subjective_price_usd,
           buy_intention = excluded.buy_intention,
           observations = excluded.observations,
           submitted_at = excluded.submitted_at`,
      )
      .bind(
        o.id,
        o.org_id,
        o.property_id,
        o.agent_id,
        o.slug,
        o.visitor_name,
        o.visitor_email,
        o.visitor_phone,
        o.liked,
        o.disliked,
        o.subjective_price_usd,
        o.buy_intention,
        o.observations,
        o.submitted_at,
        o.sent_at,
        o.created_at,
      )
      .run()
  }

  async findById(id: string, orgId: string): Promise<PropertyVisitForm | null> {
    const row = (await this.db
      .prepare('SELECT * FROM property_visit_forms WHERE id = ? AND org_id = ?')
      .bind(id, orgId)
      .first()) as any
    return row ? this.toEntity(row) : null
  }

  async findBySlug(slug: string): Promise<PropertyVisitForm | null> {
    const row = (await this.db
      .prepare('SELECT * FROM property_visit_forms WHERE slug = ?')
      .bind(slug)
      .first()) as any
    return row ? this.toEntity(row) : null
  }

  async findBySlugWithContext(slug: string): Promise<PropertyVisitFormWithContext | null> {
    const row = (await this.db
      .prepare(
        `SELECT
           f.id as f_id, f.org_id as f_org_id, f.property_id as f_property_id,
           f.agent_id as f_agent_id, f.slug as f_slug,
           f.visitor_name as f_visitor_name, f.visitor_email as f_visitor_email,
           f.visitor_phone as f_visitor_phone, f.liked as f_liked, f.disliked as f_disliked,
           f.subjective_price_usd as f_subjective_price_usd,
           f.buy_intention as f_buy_intention, f.observations as f_observations,
           f.submitted_at as f_submitted_at, f.sent_at as f_sent_at, f.created_at as f_created_at,
           p.id as p_id, p.address as p_address, p.neighborhood as p_neighborhood,
           p.city as p_city, p.cover_photo as p_cover_photo,
           p.asking_price as p_asking_price, p.currency as p_currency,
           o.id as o_id, o.name as o_name, o.logo_url as o_logo_url, o.brand_color as o_brand_color
         FROM property_visit_forms f
         INNER JOIN properties p ON f.property_id = p.id
         INNER JOIN organizations o ON f.org_id = o.id
         WHERE f.slug = ?`,
      )
      .bind(slug)
      .first()) as any

    if (!row) return null

    const form = this.toEntity({
      id: row.f_id,
      org_id: row.f_org_id,
      property_id: row.f_property_id,
      agent_id: row.f_agent_id,
      slug: row.f_slug,
      visitor_name: row.f_visitor_name,
      visitor_email: row.f_visitor_email,
      visitor_phone: row.f_visitor_phone,
      liked: row.f_liked,
      disliked: row.f_disliked,
      subjective_price_usd: row.f_subjective_price_usd,
      buy_intention: row.f_buy_intention,
      observations: row.f_observations,
      submitted_at: row.f_submitted_at,
      sent_at: row.f_sent_at,
      created_at: row.f_created_at,
    })

    return {
      form,
      property: {
        id: row.p_id,
        address: row.p_address,
        neighborhood: row.p_neighborhood ?? null,
        city: row.p_city ?? null,
        cover_photo: row.p_cover_photo ?? null,
        asking_price: row.p_asking_price ?? null,
        currency: row.p_currency ?? null,
      },
      org: {
        id: row.o_id,
        name: row.o_name,
        logo_url: row.o_logo_url ?? null,
        brand_color: row.o_brand_color ?? null,
      },
    }
  }

  async listByProperty(propertyId: string, orgId: string): Promise<PropertyVisitForm[]> {
    const result = await this.db
      .prepare(
        'SELECT * FROM property_visit_forms WHERE property_id = ? AND org_id = ? ORDER BY COALESCE(submitted_at, sent_at) DESC',
      )
      .bind(propertyId, orgId)
      .all()
    const rows = (result?.results ?? []) as any[]
    return rows.map((r) => this.toEntity(r))
  }

  async existsBySlug(slug: string): Promise<boolean> {
    const row = await this.db
      .prepare('SELECT 1 AS hit FROM property_visit_forms WHERE slug = ? LIMIT 1')
      .bind(slug)
      .first()
    return row !== null
  }

  private toEntity(row: any): PropertyVisitForm {
    return PropertyVisitForm.create({
      id: row.id,
      org_id: row.org_id,
      property_id: row.property_id,
      agent_id: row.agent_id,
      slug: row.slug,
      visitor_name: row.visitor_name ?? null,
      visitor_email: row.visitor_email ?? null,
      visitor_phone: row.visitor_phone ?? null,
      liked: row.liked ?? null,
      disliked: row.disliked ?? null,
      subjective_price_usd:
        row.subjective_price_usd === null || row.subjective_price_usd === undefined
          ? null
          : Number(row.subjective_price_usd),
      buy_intention: (row.buy_intention ?? null) as BuyIntention | null,
      observations: row.observations ?? null,
      submitted_at: row.submitted_at ?? null,
      sent_at: row.sent_at,
      created_at: row.created_at,
    })
  }
}
