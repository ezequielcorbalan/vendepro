import { describe, it, expect, vi } from 'vitest'
import { GetPublicAppraisalUseCase } from '../../../src/application/use-cases/public/get-public-appraisal'
import { Appraisal } from '../../../src/domain/entities/appraisal'
import { TemplateBlock } from '../../../src/domain/entities/template-block'

const makeAppraisal = () =>
  Appraisal.create({
    id: 'appr-1',
    org_id: 'org-1',
    property_address: 'Av. Corrientes 500',
    neighborhood: 'San Nicolás',
    city: 'Buenos Aires',
    property_type: 'departamento',
    covered_area: 60,
    total_area: 65,
    semi_area: null,
    weighted_area: null,
    strengths: null,
    weaknesses: null,
    opportunities: null,
    threats: null,
    publication_analysis: null,
    suggested_price: 120000,
    test_price: null,
    expected_close_price: null,
    usd_per_m2: 2000,
    canva_design_id: null,
    canva_edit_url: null,
    agent_id: 'agent-1',
    lead_id: null,
    status: 'draft',
    public_slug: 'corrientes-500',
  })

const makeBlock = () =>
  TemplateBlock.create({
    id: 'block-1',
    org_id: 'org-1',
    block_type: 'service',
    title: 'Fotografía profesional',
    description: null,
    icon: null,
    number_label: null,
    video_url: null,
    image_url: null,
    sort_order: 1,
    enabled: 1,
    section: 'commercial',
  })

const mockOrg = { name: 'Test Inmobiliaria', logo_url: null, brand_color: '#ff007c' }

describe('GetPublicAppraisalUseCase', () => {
  it('returns appraisal, org and enabled blocks when found', async () => {
    const appraisalRepo = {
      findPublicByIdOrSlugWithOrg: vi.fn().mockResolvedValue({ appraisal: makeAppraisal(), org: mockOrg }),
    } as any
    const blockRepo = { findEnabledByOrg: vi.fn().mockResolvedValue([makeBlock()]) } as any

    const uc = new GetPublicAppraisalUseCase(appraisalRepo, blockRepo)
    const result = await uc.execute('corrientes-500')

    expect(result).not.toBeNull()
    expect(result!.appraisal.id).toBe('appr-1')
    expect(result!.org.name).toBe('Test Inmobiliaria')
    expect(result!.blocks).toHaveLength(1)
    expect(result!.blocks[0].id).toBe('block-1')
    expect(blockRepo.findEnabledByOrg).toHaveBeenCalledWith('org-1')
  })

  it('returns null when appraisal not found', async () => {
    const appraisalRepo = {
      findPublicByIdOrSlugWithOrg: vi.fn().mockResolvedValue(null),
    } as any
    const blockRepo = { findEnabledByOrg: vi.fn() } as any

    const uc = new GetPublicAppraisalUseCase(appraisalRepo, blockRepo)
    const result = await uc.execute('no-such-slug')

    expect(result).toBeNull()
    expect(blockRepo.findEnabledByOrg).not.toHaveBeenCalled()
  })
})
