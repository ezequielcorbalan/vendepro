import { describe, it, expect, beforeEach } from 'vitest'
import { Miniflare } from 'miniflare'
import { D1FichaLinkRepository } from '../../src/repositories/d1-ficha-link-repository'
import { FichaLink } from '@vendepro/core'

// Espejo de `ficha_links` en 041_ficha_publica.sql, sin las FK a users/leads
// (este test sólo ejercita el adapter, no la integridad referencial).
const MIG = `CREATE TABLE ficha_links (
  id TEXT PRIMARY KEY, org_id TEXT NOT NULL, agent_id TEXT,
  mode TEXT NOT NULL DEFAULT 'single' CHECK (mode IN ('single','open')),
  slug TEXT NOT NULL, label TEXT, lead_id TEXT, prefill_json TEXT,
  active INTEGER NOT NULL DEFAULT 1, submissions_count INTEGER NOT NULL DEFAULT 0,
  last_submitted_at TEXT, archived_at TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE UNIQUE INDEX idx_ficha_links_slug ON ficha_links(slug);`

describe('D1FichaLinkRepository', () => {
  let db: D1Database
  let repo: D1FichaLinkRepository

  beforeEach(async () => {
    const mf = new Miniflare({ d1Databases: { DB: ':memory:' }, modules: true, script: 'export default {}' })
    db = await mf.getD1Database('DB')
    for (const stmt of MIG.split(';').map(s => s.trim()).filter(Boolean)) {
      await db.prepare(stmt).run()
    }
    repo = new D1FichaLinkRepository(db)
  })

  const makeLink = (o: any = {}) => FichaLink.create({
    id: o.id ?? 'l1',
    org_id: o.org_id ?? 'org-1',
    agent_id: o.agent_id === undefined ? 'agent-1' : o.agent_id,
    mode: o.mode ?? 'single',
    slug: o.slug ?? 'slug-1',
    label: o.label ?? null,
    lead_id: o.lead_id ?? null,
    prefill: o.prefill ?? null,
    archived_at: o.archived_at ?? null,
  })

  it('guarda y recupera por slug con el prefill deserializado', async () => {
    await repo.save(makeLink({ prefill: { address: 'Libertador 2340', owner_name: 'Juan' } }))
    const found = await repo.findBySlug('slug-1')

    expect(found?.id).toBe('l1')
    expect(found?.prefill).toEqual({ address: 'Libertador 2340', owner_name: 'Juan' })
  })

  it('findById no cruza organizaciones', async () => {
    await repo.save(makeLink())
    expect(await repo.findById('l1', 'org-1')).not.toBeNull()
    expect(await repo.findById('l1', 'otra-org')).toBeNull()
  })

  it('registerSubmission incrementa el contador y sella la fecha', async () => {
    await repo.save(makeLink())
    await repo.registerSubmission('l1')
    await repo.registerSubmission('l1')

    const found = await repo.findBySlug('slug-1')
    expect(found?.submissions_count).toBe(2)
    expect(found?.toObject().last_submitted_at).not.toBeNull()
  })

  it('un link single deja de aceptar envíos después del primero', async () => {
    await repo.save(makeLink({ mode: 'single', lead_id: 'lead-1' }))
    expect((await repo.findBySlug('slug-1'))?.acceptsSubmissions()).toBe(true)

    await repo.registerSubmission('l1')
    expect((await repo.findBySlug('slug-1'))?.acceptsSubmissions()).toBe(false)
  })

  it('un link open sigue aceptando envíos', async () => {
    await repo.save(makeLink({ mode: 'open' }))
    await repo.registerSubmission('l1')
    expect((await repo.findBySlug('slug-1'))?.acceptsSubmissions()).toBe(true)
  })

  it('findOpenLink distingue el link del agente del institucional', async () => {
    await repo.save(makeLink({ id: 'l-agente', slug: 's-agente', mode: 'open', agent_id: 'agent-1' }))
    await repo.save(makeLink({ id: 'l-org', slug: 's-org', mode: 'open', agent_id: null }))

    expect((await repo.findOpenLink('org-1', 'agent-1'))?.id).toBe('l-agente')
    // `agent_id = NULL` nunca matchea en SQL: el repo tiene que usar IS NULL.
    expect((await repo.findOpenLink('org-1', null))?.id).toBe('l-org')
    expect(await repo.findOpenLink('org-1', 'agent-sin-link')).toBeNull()
  })

  it('archivar cierra el link y desarchivar lo devuelve', async () => {
    await repo.save(makeLink({ mode: 'open' }))
    await repo.setArchived('l1', 'org-1', true)
    expect((await repo.findBySlug('slug-1'))?.acceptsSubmissions()).toBe(false)

    await repo.setArchived('l1', 'org-1', false)
    expect((await repo.findBySlug('slug-1'))?.acceptsSubmissions()).toBe(true)
  })

  it('un link archivado no aparece en el listado salvo que se pida', async () => {
    await repo.save(makeLink({ id: 'l-vivo', slug: 's-vivo' }))
    await repo.save(makeLink({ id: 'l-muerto', slug: 's-muerto' }))
    await repo.setArchived('l-muerto', 'org-1', true)

    expect((await repo.findByOrg('org-1')).map(l => l.id)).toEqual(['l-vivo'])
    expect((await repo.findByOrg('org-1', { include_archived: true })).length).toBe(2)
  })

  it('un archivado no se ofrece como link abierto vigente', async () => {
    await repo.save(makeLink({ mode: 'open' }))
    await repo.setArchived('l1', 'org-1', true)
    expect(await repo.findOpenLink('org-1', 'agent-1')).toBeNull()
  })

  it('existsBySlug detecta la colisión', async () => {
    await repo.save(makeLink())
    expect(await repo.existsBySlug('slug-1')).toBe(true)
    expect(await repo.existsBySlug('slug-libre')).toBe(false)
  })
})
