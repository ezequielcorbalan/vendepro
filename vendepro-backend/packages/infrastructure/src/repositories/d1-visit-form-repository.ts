import { VisitForm, VisitFormResponse } from '@vendepro/core'
import type { VisitFormRepository, VisitFormField } from '@vendepro/core'

export class D1VisitFormRepository implements VisitFormRepository {
  constructor(private readonly db: D1Database) {}

  async findById(id: string, orgId: string): Promise<VisitForm | null> {
    const row = (await this.db
      .prepare('SELECT * FROM visit_forms WHERE id = ? AND org_id = ?')
      .bind(id, orgId)
      .first()) as any
    return row ? this.toEntity(row) : null
  }

  async findByPublicSlug(slug: string): Promise<{
    form: VisitForm
    property: { address: string; neighborhood: string }
    org: { name: string; logo_url: string | null; brand_color: string | null }
  } | null> {
    const row = (await this.db
      .prepare(
        `SELECT
           vf.id AS vf_id, vf.org_id AS vf_org_id, vf.property_id AS vf_property_id,
           vf.public_slug AS vf_public_slug, vf.fields AS vf_fields,
           vf.created_at AS vf_created_at, vf.updated_at AS vf_updated_at,
           p.address AS p_address, p.neighborhood AS p_neighborhood,
           o.name AS o_name, o.logo_url AS o_logo_url, o.brand_color AS o_brand_color
         FROM visit_forms vf
         INNER JOIN properties p ON vf.property_id = p.id
         INNER JOIN organizations o ON vf.org_id = o.id
         WHERE vf.public_slug = ?`,
      )
      .bind(slug)
      .first()) as any
    if (!row) return null
    const form = this.toEntity({
      id: row.vf_id,
      org_id: row.vf_org_id,
      property_id: row.vf_property_id,
      public_slug: row.vf_public_slug,
      fields: row.vf_fields,
      created_at: row.vf_created_at,
      updated_at: row.vf_updated_at,
    })
    return {
      form,
      property: { address: row.p_address, neighborhood: row.p_neighborhood },
      org: {
        name: row.o_name,
        logo_url: row.o_logo_url ?? null,
        brand_color: row.o_brand_color ?? null,
      },
    }
  }

  async save(form: VisitForm): Promise<void> {
    const o = form.toObject()
    await this.db
      .prepare(
        `INSERT INTO visit_forms (id, org_id, property_id, public_slug, fields, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           org_id = excluded.org_id,
           property_id = excluded.property_id,
           public_slug = excluded.public_slug,
           fields = excluded.fields,
           updated_at = excluded.updated_at`,
      )
      .bind(
        o.id,
        o.org_id,
        o.property_id,
        o.public_slug,
        JSON.stringify(o.fields),
        o.created_at,
        o.updated_at,
      )
      .run()
  }

  async saveResponse(response: VisitFormResponse): Promise<void> {
    const o = response.toObject()
    await this.db
      .prepare(
        `INSERT INTO visit_form_responses (id, form_id, visitor_name, visitor_phone, visitor_email, responses, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        o.id,
        o.form_id,
        o.visitor_name,
        o.visitor_phone,
        o.visitor_email,
        JSON.stringify(o.responses),
        o.created_at,
      )
      .run()
  }

  private toEntity(row: any): VisitForm {
    const fields: VisitFormField[] = typeof row.fields === 'string'
      ? JSON.parse(row.fields)
      : (row.fields ?? [])
    return VisitForm.create({
      id: row.id,
      org_id: row.org_id,
      property_id: row.property_id,
      public_slug: row.public_slug,
      fields,
      created_at: row.created_at,
      updated_at: row.updated_at,
    })
  }
}
