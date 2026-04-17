import { describe, it, expect, afterAll, beforeAll, beforeEach } from 'vitest'
import { createTestDB, closeTestDB, type TestEnv } from '../helpers/d1-test-env'
import { seedOrg, seedUser, nextId } from '../helpers/fixtures'
import { D1PropertyRepository } from '../../src/repositories/d1-property-repository'

/**
 * Creates the `property_photos` table used by photo methods. The v2 migrations
 * don't declare this table (it lives in the legacy schema referenced by the
 * worker), so test setup creates it explicitly.
 */
async function createPropertyPhotosTable(db: D1Database) {
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS property_photos (
         id TEXT PRIMARY KEY,
         org_id TEXT NOT NULL,
         property_id TEXT NOT NULL,
         url TEXT NOT NULL,
         r2_key TEXT NOT NULL,
         sort_order INTEGER NOT NULL DEFAULT 0,
         created_at TEXT DEFAULT (datetime('now'))
       )`,
    )
    .run()
}

/** Insert a property row directly. Returns the id. */
async function insertProperty(
  db: D1Database,
  orgId: string,
  agentId: string,
  overrides: Partial<{
    id: string
    slug: string
    address: string
    operation_type: string
    operation_type_id: number
    commercial_stage: string | null
    commercial_stage_id: number | null
    status: string
    status_id: number | null
    asking_price: number | null
  }> = {},
) {
  const id = overrides.id ?? nextId('prop')
  const slug = overrides.slug ?? `slug-${id}`
  const address = overrides.address ?? 'Av. Test 1'
  await db
    .prepare(
      `INSERT INTO properties (
         id, org_id, address, neighborhood, city, property_type, rooms, size_m2,
         asking_price, currency, owner_name, public_slug, agent_id, status,
         operation_type, operation_type_id, commercial_stage, commercial_stage_id, status_id,
         created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
    )
    .bind(
      id,
      orgId,
      address,
      'Palermo',
      'Buenos Aires',
      'departamento',
      2,
      60,
      overrides.asking_price ?? 150000,
      'USD',
      'Owner',
      slug,
      agentId,
      overrides.status ?? 'active',
      overrides.operation_type ?? 'venta',
      overrides.operation_type_id ?? 1,
      overrides.commercial_stage ?? null,
      overrides.commercial_stage_id ?? null,
      overrides.status_id ?? 1,
    )
    .run()
  return id
}

describe('D1PropertyRepository', () => {
  let env: TestEnv
  let orgId: string
  let agentId: string

  beforeAll(async () => {
    env = await createTestDB()
    await createPropertyPhotosTable(env.DB)
  })

  afterAll(async () => {
    await closeTestDB(env)
  })

  beforeEach(async () => {
    const org = await seedOrg(env.DB)
    orgId = org.id
    const user = await seedUser(env.DB, orgId)
    agentId = user.id
  })

  it('findById returns property with contact_id populated (no duplicate key bug)', async () => {
    const contactId = nextId('contact')
    const propId = nextId('prop')
    const slug = `slug-${propId}`

    // Insert contact — the v2 schema uses columns: id, org_id, full_name, phone, email,
    // contact_type, neighborhood, notes, source, agent_id, created_at. No updated_at column.
    await env.DB
      .prepare(
        `INSERT INTO contacts (id, org_id, full_name, phone, email, contact_type, agent_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      )
      .bind(contactId, orgId, 'Juan Propietario', '+541112345678', 'juan@test.com', 'propietario', agentId)
      .run()

    // Insert property — using columns from the v2 schema plus contact_id added via ALTER above.
    await env.DB
      .prepare(
        `INSERT INTO properties (
           id, org_id, address, neighborhood, city, property_type, rooms, size_m2,
           asking_price, currency, owner_name, owner_phone, owner_email, public_slug,
           agent_id, status, contact_id, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      )
      .bind(
        propId,
        orgId,
        'Av. Corrientes 1234',
        'Balvanera',
        'Buenos Aires',
        'departamento',
        2,
        65.5,
        150000,
        'USD',
        'Juan Propietario',
        '+541112345678',
        'juan@test.com',
        slug,
        agentId,
        'active',
        contactId,
      )
      .run()

    const repo = new D1PropertyRepository(env.DB)
    const prop = await repo.findById(propId, orgId)

    expect(prop).not.toBeNull()
    const obj = prop!.toObject()
    expect(obj.id).toBe(propId)
    expect(obj.org_id).toBe(orgId)
    expect(obj.contact_id).toBe(contactId)
  })
})

describe('D1PropertyRepository — extended methods', () => {
  let env: TestEnv
  let orgId: string
  let agentId: string

  beforeAll(async () => {
    env = await createTestDB()
    await createPropertyPhotosTable(env.DB)
  })

  afterAll(async () => {
    await closeTestDB(env)
  })

  beforeEach(async () => {
    const org = await seedOrg(env.DB)
    orgId = org.id
    const user = await seedUser(env.DB, orgId)
    agentId = user.id
  })

  it('addPhoto + findPhotos round-trip', async () => {
    const repo = new D1PropertyRepository(env.DB)
    const propId = await insertProperty(env.DB, orgId, agentId)

    const photo = {
      id: nextId('photo'),
      property_id: propId,
      org_id: orgId,
      url: 'https://cdn.example.com/a.jpg',
      r2_key: `props/${propId}/a.jpg`,
      sort_order: 0,
      created_at: new Date().toISOString(),
    }
    await repo.addPhoto(photo)

    const photos = await repo.findPhotos(propId, orgId)
    expect(photos.length).toBe(1)
    expect(photos[0]!.id).toBe(photo.id)
    expect(photos[0]!.url).toBe(photo.url)
    expect(photos[0]!.r2_key).toBe(photo.r2_key)
  })

  it('deletePhoto removes it', async () => {
    const repo = new D1PropertyRepository(env.DB)
    const propId = await insertProperty(env.DB, orgId, agentId)
    const photoId = nextId('photo')
    await repo.addPhoto({
      id: photoId,
      property_id: propId,
      org_id: orgId,
      url: 'https://x/a.jpg',
      r2_key: 'k1',
      sort_order: 0,
      created_at: new Date().toISOString(),
    })

    await repo.deletePhoto(photoId, orgId)
    const after = await repo.findPhotos(propId, orgId)
    expect(after.length).toBe(0)
  })

  it('deletePhoto with wrong orgId is a no-op (scoping)', async () => {
    const repo = new D1PropertyRepository(env.DB)
    const propId = await insertProperty(env.DB, orgId, agentId)
    const photoId = nextId('photo')
    await repo.addPhoto({
      id: photoId,
      property_id: propId,
      org_id: orgId,
      url: 'https://x/b.jpg',
      r2_key: 'k2',
      sort_order: 0,
      created_at: new Date().toISOString(),
    })

    const otherOrg = await seedOrg(env.DB)
    await repo.deletePhoto(photoId, otherOrg.id)

    const photos = await repo.findPhotos(propId, orgId)
    expect(photos.length).toBe(1)
  })

  it('reorderPhotos updates sort_order', async () => {
    const repo = new D1PropertyRepository(env.DB)
    const propId = await insertProperty(env.DB, orgId, agentId)
    const p1 = nextId('photo')
    const p2 = nextId('photo')
    await repo.addPhoto({ id: p1, property_id: propId, org_id: orgId, url: 'u1', r2_key: 'k1', sort_order: 0, created_at: new Date().toISOString() })
    await repo.addPhoto({ id: p2, property_id: propId, org_id: orgId, url: 'u2', r2_key: 'k2', sort_order: 1, created_at: new Date().toISOString() })

    // Swap order: p2 first, p1 second
    await repo.reorderPhotos(propId, orgId, [
      { id: p2, sort_order: 0 },
      { id: p1, sort_order: 1 },
    ])

    const photos = await repo.findPhotos(propId, orgId)
    expect(photos.map(p => p.id)).toEqual([p2, p1])
  })

  it('update patches specified fields, leaves others unchanged', async () => {
    const repo = new D1PropertyRepository(env.DB)
    const propId = await insertProperty(env.DB, orgId, agentId, { asking_price: 100000 })

    await repo.update(propId, orgId, {
      asking_price: 175000,
      commercial_stage: 'publicada',
    })

    const row = await env.DB
      .prepare('SELECT asking_price, commercial_stage, neighborhood, address FROM properties WHERE id = ?')
      .bind(propId)
      .first() as any
    expect(row.asking_price).toBe(175000)
    expect(row.commercial_stage).toBe('publicada')
    expect(row.neighborhood).toBe('Palermo')
    expect(row.address).toBe('Av. Test 1')
  })

  it('updateStage with valid slug updates commercial_stage + commercial_stage_id', async () => {
    const repo = new D1PropertyRepository(env.DB)
    const propId = await insertProperty(env.DB, orgId, agentId, { operation_type_id: 1 })

    await repo.updateStage(propId, orgId, 'publicada')

    const row = await env.DB
      .prepare('SELECT commercial_stage, commercial_stage_id FROM properties WHERE id = ?')
      .bind(propId)
      .first() as any
    expect(row.commercial_stage).toBe('publicada')
    expect(typeof row.commercial_stage_id).toBe('number')
    // publicada for venta is stage id 2 per seed
    const expectedId = (await env.DB
      .prepare('SELECT id FROM commercial_stages WHERE operation_type_id = 1 AND slug = ?')
      .bind('publicada')
      .first()) as any
    expect(row.commercial_stage_id).toBe(expectedId.id)
  })

  it('updateStage throws on invalid slug', async () => {
    const repo = new D1PropertyRepository(env.DB)
    const propId = await insertProperty(env.DB, orgId, agentId)

    await expect(repo.updateStage(propId, orgId, 'no-such-stage')).rejects.toThrow('invalid stage')
  })

  it('findCatalogs returns seed data (2 operation_types, 12 commercial_stages, 11 property_statuses)', async () => {
    const repo = new D1PropertyRepository(env.DB)
    const cat = await repo.findCatalogs()

    expect(cat.operation_types.length).toBe(2)
    expect(cat.operation_types.map(t => t.slug).sort()).toEqual(['alquiler', 'venta'])

    expect(cat.commercial_stages.length).toBe(12)
    expect(typeof cat.commercial_stages[0]!.is_terminal).toBe('boolean')

    expect(cat.property_statuses.length).toBe(11)
  })

  it('markExternalReport sets timestamp; clearExternalReport resets it to null', async () => {
    const repo = new D1PropertyRepository(env.DB)
    const propId = await insertProperty(env.DB, orgId, agentId)

    await repo.markExternalReport(propId, orgId)
    let row = await env.DB
      .prepare('SELECT last_external_report_at FROM properties WHERE id = ?')
      .bind(propId)
      .first() as any
    expect(row.last_external_report_at).not.toBeNull()

    await repo.clearExternalReport(propId, orgId)
    row = await env.DB
      .prepare('SELECT last_external_report_at FROM properties WHERE id = ?')
      .bind(propId)
      .first() as any
    expect(row.last_external_report_at).toBeNull()
  })

  it('searchByAddress returns matching properties', async () => {
    const repo = new D1PropertyRepository(env.DB)
    await insertProperty(env.DB, orgId, agentId, { address: 'Av. Corrientes 1234' })
    await insertProperty(env.DB, orgId, agentId, { address: 'Calle Falsa 742' })

    const results = await repo.searchByAddress(orgId, 'Corrientes', 5)
    expect(results.length).toBe(1)
    expect(results[0]!.address).toBe('Av. Corrientes 1234')
  })

  it('searchByAddress respects limit', async () => {
    const repo = new D1PropertyRepository(env.DB)
    await insertProperty(env.DB, orgId, agentId, { address: 'Av. Santa Fe 100' })
    await insertProperty(env.DB, orgId, agentId, { address: 'Av. Santa Fe 200' })
    await insertProperty(env.DB, orgId, agentId, { address: 'Av. Santa Fe 300' })

    const results = await repo.searchByAddress(orgId, 'Santa Fe', 2)
    expect(results.length).toBe(2)
  })
})
