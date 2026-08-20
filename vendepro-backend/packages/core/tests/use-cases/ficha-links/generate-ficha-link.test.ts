import { describe, it, expect, vi } from 'vitest'
import { GenerateFichaLinkUseCase } from '../../../src/application/use-cases/ficha-links/generate-ficha-link'
import { FichaLink } from '../../../src/domain/entities/ficha-link'
import { NotFoundError } from '../../../src/domain/errors/not-found'
import { ValidationError } from '../../../src/domain/errors/validation-error'

const leadObject = {
  id: 'lead-1',
  full_name: 'Juan Pérez',
  phone: '11 5555 5555',
  email: 'juan@mail.com',
  property_address: 'Av. Libertador 2340',
  neighborhood: 'Martínez',
  property_type: 'departamento',
}

function build(over: Record<string, any> = {}) {
  let n = 0
  const repo = {
    findOpenLink: vi.fn().mockResolvedValue(null),
    existsBySlug: vi.fn().mockResolvedValue(false),
    save: vi.fn().mockResolvedValue(undefined),
    ...(over.repo ?? {}),
  }
  const leadRepo = {
    findById: vi.fn().mockResolvedValue({ id: 'lead-1', toObject: () => leadObject }),
    ...(over.leadRepo ?? {}),
  }
  const ids = { generate: vi.fn(() => `abcdef${++n}`) }
  return { uc: new GenerateFichaLinkUseCase(repo as any, ids as any, leadRepo as any), repo, leadRepo, ids }
}

describe('GenerateFichaLinkUseCase', () => {
  it('genera un link abierto con slug de 14 caracteres', async () => {
    const { uc, repo } = build()
    const result = await uc.execute({ org_id: 'org-1', agent_id: 'agent-1', mode: 'open' })

    expect(result.mode).toBe('open')
    expect(result.reused).toBe(false)
    expect(result.slug).toHaveLength(14)
    expect(repo.save).toHaveBeenCalledOnce()
  })

  it('devuelve el link abierto que ya existe en vez de crear otro', async () => {
    // El link abierto vive pegado en la bio de Instagram: regenerarlo rompería
    // los que ya están publicados.
    const existing = FichaLink.create({
      id: 'link-existente',
      org_id: 'org-1',
      agent_id: 'agent-1',
      mode: 'open',
      slug: 'yaexistente01',
      label: null,
      lead_id: null,
      prefill: null,
    })
    const { uc, repo } = build({ repo: { findOpenLink: vi.fn().mockResolvedValue(existing) } })
    const result = await uc.execute({ org_id: 'org-1', agent_id: 'agent-1', mode: 'open' })

    expect(result.reused).toBe(true)
    expect(result.id).toBe('link-existente')
    expect(repo.save).not.toHaveBeenCalled()
  })

  it('el link institucional se guarda sin agente', async () => {
    const { uc, repo } = build()
    await uc.execute({ org_id: 'org-1', agent_id: 'agent-1', mode: 'open', institutional: true })

    expect(repo.findOpenLink).toHaveBeenCalledWith('org-1', null)
    expect(repo.save.mock.calls[0][0].agent_id).toBeNull()
  })

  it('el link dirigido se pre-llena con los datos del lead', async () => {
    const { uc, repo } = build()
    await uc.execute({ org_id: 'org-1', agent_id: 'agent-1', mode: 'single', lead_id: 'lead-1' })

    const saved = repo.save.mock.calls[0][0].toObject()
    expect(saved.lead_id).toBe('lead-1')
    expect(saved.prefill).toEqual({
      address: 'Av. Libertador 2340',
      neighborhood: 'Martínez',
      property_type: 'departamento',
      owner_name: 'Juan Pérez',
      owner_phone: '11 5555 5555',
      owner_email: 'juan@mail.com',
    })
  })

  it('un pre-llenado explícito le gana al del lead', async () => {
    const { uc, repo } = build()
    await uc.execute({
      org_id: 'org-1',
      agent_id: 'agent-1',
      mode: 'single',
      lead_id: 'lead-1',
      prefill: { address: 'Otra dirección 100' },
    })

    const saved = repo.save.mock.calls[0][0].toObject()
    expect(saved.prefill.address).toBe('Otra dirección 100')
    expect(saved.prefill.neighborhood).toBe('Martínez')
  })

  it('reintenta el slug ante colisión', async () => {
    const existsBySlug = vi.fn()
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false)
    const { uc, repo } = build({ repo: { existsBySlug } })
    await uc.execute({ org_id: 'org-1', agent_id: 'agent-1', mode: 'open' })

    expect(existsBySlug).toHaveBeenCalledTimes(2)
    expect(repo.save).toHaveBeenCalledOnce()
  })

  it('falla si el slug colisiona cinco veces seguidas', async () => {
    const { uc } = build({ repo: { existsBySlug: vi.fn().mockResolvedValue(true) } })
    await expect(
      uc.execute({ org_id: 'org-1', agent_id: 'agent-1', mode: 'open' }),
    ).rejects.toThrow(ValidationError)
  })

  it('un link dirigido sin lead_id es inválido', async () => {
    const { uc } = build()
    await expect(
      uc.execute({ org_id: 'org-1', agent_id: 'agent-1', mode: 'single' }),
    ).rejects.toThrow(ValidationError)
  })

  it('rechaza un lead de otra org', async () => {
    const { uc } = build({ leadRepo: { findById: vi.fn().mockResolvedValue(null) } })
    await expect(
      uc.execute({ org_id: 'org-1', agent_id: 'agent-1', mode: 'single', lead_id: 'lead-ajeno' }),
    ).rejects.toThrow(NotFoundError)
  })
})
