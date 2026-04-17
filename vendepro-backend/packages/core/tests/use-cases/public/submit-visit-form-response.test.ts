import { describe, it, expect, vi } from 'vitest'
import { SubmitVisitFormResponseUseCase } from '../../../src/application/use-cases/public/submit-visit-form-response'
import { VisitForm } from '../../../src/domain/entities/visit-form'
import { NotFoundError } from '../../../src/domain/errors/not-found'
import { ValidationError } from '../../../src/domain/errors/validation-error'

const makeForm = () =>
  VisitForm.create({
    id: 'form-1',
    org_id: 'org-1',
    property_id: 'prop-1',
    public_slug: 'visit-form-abc',
    fields: [{ key: 'opinion', label: 'Opinión', type: 'text', required: false }],
  })

const mockHydrated = {
  form: makeForm(),
  property: { address: 'Av. Libertador 100', neighborhood: 'Palermo' },
  org: { name: 'Inmobiliaria MG', logo_url: null, brand_color: '#ff007c' },
}

describe('SubmitVisitFormResponseUseCase', () => {
  it('saves response and returns id on success', async () => {
    const visitFormRepo = {
      findByPublicSlug: vi.fn().mockResolvedValue(mockHydrated),
      saveResponse: vi.fn().mockResolvedValue(undefined),
    } as any
    const ids = { generate: vi.fn().mockReturnValue('resp-id-1') }

    const uc = new SubmitVisitFormResponseUseCase(visitFormRepo, ids)
    const result = await uc.execute({
      slug: 'visit-form-abc',
      visitor_name: 'Ana Pérez',
      visitor_phone: '+5491123456789',
      visitor_email: null,
      responses: { opinion: 'Muy bueno' },
    })

    expect(result.id).toBe('resp-id-1')
    expect(visitFormRepo.saveResponse).toHaveBeenCalledOnce()
    const savedResponse = visitFormRepo.saveResponse.mock.calls[0][0]
    expect(savedResponse.form_id).toBe('form-1')
    expect(savedResponse.visitor_name).toBe('Ana Pérez')
  })

  it('throws NotFoundError when slug does not exist', async () => {
    const visitFormRepo = {
      findByPublicSlug: vi.fn().mockResolvedValue(null),
      saveResponse: vi.fn(),
    } as any
    const ids = { generate: vi.fn().mockReturnValue('resp-id-x') }

    const uc = new SubmitVisitFormResponseUseCase(visitFormRepo, ids)
    await expect(
      uc.execute({ slug: 'bad-slug', visitor_name: 'Test', visitor_phone: '+5491100000000' }),
    ).rejects.toThrow(NotFoundError)

    expect(visitFormRepo.saveResponse).not.toHaveBeenCalled()
  })

  it('throws ValidationError when visitor_name is missing', async () => {
    const visitFormRepo = {
      findByPublicSlug: vi.fn().mockResolvedValue(mockHydrated),
      saveResponse: vi.fn(),
    } as any
    const ids = { generate: vi.fn().mockReturnValue('resp-id-2') }

    const uc = new SubmitVisitFormResponseUseCase(visitFormRepo, ids)
    await expect(
      uc.execute({ slug: 'visit-form-abc', visitor_name: '', visitor_phone: '+5491100000000' }),
    ).rejects.toThrow(ValidationError)
  })

  it('throws ValidationError when neither phone nor email is provided', async () => {
    const visitFormRepo = {
      findByPublicSlug: vi.fn().mockResolvedValue(mockHydrated),
      saveResponse: vi.fn(),
    } as any
    const ids = { generate: vi.fn().mockReturnValue('resp-id-3') }

    const uc = new SubmitVisitFormResponseUseCase(visitFormRepo, ids)
    await expect(
      uc.execute({ slug: 'visit-form-abc', visitor_name: 'Sin contacto' }),
    ).rejects.toThrow(ValidationError)
  })
})
