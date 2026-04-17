import { describe, it, expect, afterAll, beforeAll, beforeEach } from 'vitest'
import { VisitForm, VisitFormResponse } from '@vendepro/core'
import { createTestDB, closeTestDB, type TestEnv } from '../helpers/d1-test-env'
import { seedOrg, seedUser, nextId } from '../helpers/fixtures'
import { D1VisitFormRepository } from '../../src/repositories/d1-visit-form-repository'

describe('D1VisitFormRepository', () => {
  let env: TestEnv
  let orgId: string
  let agentId: string
  let propertyId: string

  beforeAll(async () => {
    env = await createTestDB()
  })

  afterAll(async () => {
    await closeTestDB(env)
  })

  beforeEach(async () => {
    const org = await seedOrg(env.DB)
    orgId = org.id
    const user = await seedUser(env.DB, orgId)
    agentId = user.id
    propertyId = nextId('prop')
    await env.DB
      .prepare(
        `INSERT INTO properties (id, org_id, address, neighborhood, city, property_type, owner_name, public_slug, agent_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        propertyId,
        orgId,
        'Av. Siempre Viva 123',
        'Palermo',
        'Buenos Aires',
        'departamento',
        'Owner Test',
        `prop-slug-${propertyId}`,
        agentId,
      )
      .run()
  })

  const buildForm = (overrides: Partial<Parameters<typeof VisitForm.create>[0]> = {}) =>
    VisitForm.create({
      id: nextId('vf'),
      org_id: orgId,
      property_id: propertyId,
      public_slug: `slug-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      fields: [
        { key: 'name', label: 'Nombre', type: 'text', required: true },
        { key: 'email', label: 'Email', type: 'email', required: false },
      ],
      ...overrides,
    })

  it('save + findById round-trip parses fields JSON', async () => {
    const repo = new D1VisitFormRepository(env.DB)
    const form = buildForm()
    await repo.save(form)

    const found = await repo.findById(form.id, orgId)
    expect(found).not.toBeNull()
    const o = found!.toObject()
    expect(o.id).toBe(form.id)
    expect(o.org_id).toBe(orgId)
    expect(o.property_id).toBe(propertyId)
    expect(o.public_slug).toBe(form.public_slug)
    expect(Array.isArray(o.fields)).toBe(true)
    expect(o.fields).toHaveLength(2)
    expect(o.fields[0]).toMatchObject({ key: 'name', label: 'Nombre', type: 'text', required: true })
    expect(o.fields[1]).toMatchObject({ key: 'email', type: 'email', required: false })
  })

  it('findByPublicSlug returns form + property + org metadata', async () => {
    const repo = new D1VisitFormRepository(env.DB)
    const form = buildForm({ public_slug: 'public-slug-hit' })
    await repo.save(form)

    const result = await repo.findByPublicSlug('public-slug-hit')
    expect(result).not.toBeNull()
    expect(result!.form.id).toBe(form.id)
    expect(result!.form.fields).toHaveLength(2)
    expect(result!.property.address).toBe('Av. Siempre Viva 123')
    expect(result!.property.neighborhood).toBe('Palermo')
    expect(result!.org.name).toBe('Test Org')
    expect(result!.org.brand_color).toBeDefined()
  })

  it('findByPublicSlug returns null for missing slug', async () => {
    const repo = new D1VisitFormRepository(env.DB)
    const missing = await repo.findByPublicSlug('does-not-exist')
    expect(missing).toBeNull()
  })

  it('saveResponse persists with visitor data and parsed responses JSON', async () => {
    const repo = new D1VisitFormRepository(env.DB)
    const form = buildForm()
    await repo.save(form)

    const response = VisitFormResponse.create({
      id: nextId('vfr'),
      form_id: form.id,
      visitor_name: 'Juan Perez',
      visitor_phone: '+541112345678',
      visitor_email: 'juan@test.com',
      responses: { name: 'Juan Perez', email: 'juan@test.com' },
    })
    await repo.saveResponse(response)

    const row = (await env.DB
      .prepare('SELECT * FROM visit_form_responses WHERE id = ?')
      .bind(response.id)
      .first()) as any
    expect(row).not.toBeNull()
    expect(row.form_id).toBe(form.id)
    expect(row.visitor_name).toBe('Juan Perez')
    expect(row.visitor_phone).toBe('+541112345678')
    expect(row.visitor_email).toBe('juan@test.com')
    const parsed = JSON.parse(row.responses)
    expect(parsed).toEqual({ name: 'Juan Perez', email: 'juan@test.com' })
  })
})
