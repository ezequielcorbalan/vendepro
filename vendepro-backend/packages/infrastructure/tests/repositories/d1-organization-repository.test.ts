import { describe, it, expect, afterAll, beforeAll, beforeEach } from 'vitest'
import { createTestDB, closeTestDB, type TestEnv } from '../helpers/d1-test-env'
import { seedOrg } from '../helpers/fixtures'
import { D1OrganizationRepository } from '../../src/repositories/d1-organization-repository'

describe('D1OrganizationRepository — extended methods', () => {
  let env: TestEnv

  beforeAll(async () => {
    env = await createTestDB()
  })

  afterAll(async () => {
    await closeTestDB(env)
  })

  it('findById returns org when present, null when missing', async () => {
    const repo = new D1OrganizationRepository(env.DB)
    const org = await seedOrg(env.DB)

    const found = await repo.findById(org.id)
    expect(found).not.toBeNull()
    expect(found!.id).toBe(org.id)
    expect(found!.slug).toBe(org.slug)

    const missing = await repo.findById('nonexistent_id_xxx')
    expect(missing).toBeNull()
  })

  it('setApiKey + getApiKey + findByApiKey round-trip', async () => {
    const repo = new D1OrganizationRepository(env.DB)
    const org = await seedOrg(env.DB)

    // Initially no API key
    const before = await repo.getApiKey(org.id)
    expect(before).toBeNull()

    await repo.setApiKey(org.id, 'secret-api-key-123')

    const after = await repo.getApiKey(org.id)
    expect(after).toBe('secret-api-key-123')

    const byKey = await repo.findByApiKey('secret-api-key-123')
    expect(byKey).not.toBeNull()
    expect(byKey!.id).toBe(org.id)

    const missing = await repo.findByApiKey('does-not-exist')
    expect(missing).toBeNull()
  })

  it('updateSettings patches only specified fields (others unchanged)', async () => {
    const repo = new D1OrganizationRepository(env.DB)
    const org = await seedOrg(env.DB, { name: 'Original Name' })

    // Set brand_color via save path is complex; easier: set directly via SQL then update via repo
    await env.DB
      .prepare('UPDATE organizations SET brand_color = ?, logo_url = ? WHERE id = ?')
      .bind('#ff007c', 'https://example.com/original.png', org.id)
      .run()

    await repo.updateSettings(org.id, { name: 'New Name Only' })

    const row = await env.DB
      .prepare('SELECT name, slug, brand_color, logo_url FROM organizations WHERE id = ?')
      .bind(org.id)
      .first() as any

    expect(row.name).toBe('New Name Only')
    expect(row.slug).toBe(org.slug)
    expect(row.brand_color).toBe('#ff007c')
    expect(row.logo_url).toBe('https://example.com/original.png')
  })

  it('updateSettings throws when another org has the requested slug', async () => {
    const repo = new D1OrganizationRepository(env.DB)
    const orgA = await seedOrg(env.DB, { slug: 'slug-a-unique' })
    const orgB = await seedOrg(env.DB, { slug: 'slug-b-unique' })

    await expect(
      repo.updateSettings(orgB.id, { slug: 'slug-a-unique' }),
    ).rejects.toThrow('slug already in use')

    // Verify no mutation
    const row = await env.DB
      .prepare('SELECT slug FROM organizations WHERE id = ?')
      .bind(orgB.id)
      .first() as any
    expect(row.slug).toBe('slug-b-unique')

    // Ensure orgA untouched reference
    expect(orgA.slug).toBe('slug-a-unique')
  })

  it('updateSettings allows updating to the same slug (no-op on self)', async () => {
    const repo = new D1OrganizationRepository(env.DB)
    const org = await seedOrg(env.DB, { slug: 'keep-my-slug' })

    await expect(
      repo.updateSettings(org.id, { slug: 'keep-my-slug' }),
    ).resolves.toBeUndefined()

    const row = await env.DB
      .prepare('SELECT slug FROM organizations WHERE id = ?')
      .bind(org.id)
      .first() as any
    expect(row.slug).toBe('keep-my-slug')
  })
})
