import { describe, it, expect, vi } from 'vitest'
import { GetPublicVisitFormUseCase } from '../../../src/application/use-cases/public/get-public-visit-form'
import { VisitForm } from '../../../src/domain/entities/visit-form'

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

describe('GetPublicVisitFormUseCase', () => {
  it('returns hydrated form data when slug matches', async () => {
    const visitFormRepo = { findByPublicSlug: vi.fn().mockResolvedValue(mockHydrated) } as any

    const uc = new GetPublicVisitFormUseCase(visitFormRepo)
    const result = await uc.execute('visit-form-abc')

    expect(result).not.toBeNull()
    expect(result!.form.id).toBe('form-1')
    expect(result!.property.address).toBe('Av. Libertador 100')
    expect(result!.org.name).toBe('Inmobiliaria MG')
    expect(visitFormRepo.findByPublicSlug).toHaveBeenCalledWith('visit-form-abc')
  })

  it('returns null when slug not found', async () => {
    const visitFormRepo = { findByPublicSlug: vi.fn().mockResolvedValue(null) } as any

    const uc = new GetPublicVisitFormUseCase(visitFormRepo)
    const result = await uc.execute('no-such-slug')

    expect(result).toBeNull()
  })
})
