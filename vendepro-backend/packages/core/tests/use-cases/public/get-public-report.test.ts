import { describe, it, expect, vi } from 'vitest'
import { GetPublicReportUseCase } from '../../../src/application/use-cases/public/get-public-report'
import { Property } from '../../../src/domain/entities/property'
import { Report } from '../../../src/domain/entities/report'
import { Organization } from '../../../src/domain/entities/organization'
import { PropertyVisitForm } from '../../../src/domain/entities/property-visit-form'

const makeProperty = () =>
  Property.create({
    id: 'prop-1',
    org_id: 'org-1',
    address: 'Av. Libertador 100',
    neighborhood: 'Palermo',
    city: 'Buenos Aires',
    property_type: 'departamento',
    rooms: 3,
    size_m2: 80,
    asking_price: 150000,
    currency: 'USD',
    owner_name: 'Juan',
    owner_phone: null,
    owner_email: null,
    contact_id: null,
    public_slug: 'libertador-100',
    cover_photo: null,
    agent_id: 'agent-1',
    status: 'active',
    commercial_stage: null,
    operation_type: 'venta',
    operation_type_id: 1,
    commercial_stage_id: null,
    status_id: 1,
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z',
  })

const makeReport = () =>
  Report.create({
    id: 'report-1',
    property_id: 'prop-1',
    period_label: 'Enero 2024',
    period_start: '2024-01-01',
    period_end: '2024-01-31',
    status: 'published',
    created_by: 'agent-1',
    published_at: '2024-01-15T00:00:00.000Z',
    public_slug: 'av-libertador-100-enero-2024-a3f9b2',
  })

const makeOrg = () =>
  Organization.create({
    id: 'org-1',
    name: 'Marcela Genta',
    slug: 'marcela-genta',
    logo_url: 'https://example.com/logo.png',
    brand_color: '#ff007c',
    brand_accent_color: null,
    canva_template_id: null,
    canva_report_template_id: null,
    owner_id: null,
  })

const makeRepos = (overrides: {
  reportFound?: any
  property?: Property | null
  org?: Organization | null
  visitForms?: PropertyVisitForm[]
} = {}) => ({
  propertyRepo: {
    findById: vi
      .fn()
      .mockResolvedValue('property' in overrides ? overrides.property : makeProperty()),
  } as any,
  reportRepo: {
    findPublicBySlug: vi
      .fn()
      .mockResolvedValue(
        'reportFound' in overrides
          ? overrides.reportFound
          : { report: makeReport(), propertyId: 'prop-1', orgId: 'org-1' },
      ),
    findMetrics: vi.fn().mockResolvedValue([]),
    findContent: vi.fn().mockResolvedValue([]),
    findPhotosByReport: vi.fn().mockResolvedValue([]),
    findByOrg: vi.fn().mockResolvedValue([]),
    findCompetitorLinks: vi.fn().mockResolvedValue(overrides.competitors ?? []),
  } as any,
  orgRepo: {
    findById: vi.fn().mockResolvedValue('org' in overrides ? overrides.org : makeOrg()),
  } as any,
  visitFormRepo: {
    listByProperty: vi.fn().mockResolvedValue(overrides.visitForms ?? []),
  } as any,
})

describe('GetPublicReportUseCase', () => {
  it('returns property + report + org + empty arrays when nothing else exists', async () => {
    const { propertyRepo, reportRepo, orgRepo, visitFormRepo } = makeRepos()
    const uc = new GetPublicReportUseCase(propertyRepo, reportRepo, orgRepo, visitFormRepo)
    const result = await uc.execute('av-libertador-100-enero-2024-a3f9b2')

    expect(result).not.toBeNull()
    expect(result!.property.id).toBe('prop-1')
    expect(result!.report.id).toBe('report-1')
    expect(result!.org.id).toBe('org-1')
    expect(result!.metrics).toEqual([])
    expect(result!.content).toEqual([])
    expect(result!.photos).toEqual([])
    expect(result!.visit_forms).toEqual([])
    expect(result!.available_reports).toEqual([])
    expect(reportRepo.findPublicBySlug).toHaveBeenCalledWith('av-libertador-100-enero-2024-a3f9b2')
  })

  it('exposes other published reports of the same property in available_reports', async () => {
    const r1 = makeReport()
    const r2 = Report.create({
      id: 'report-2',
      property_id: 'prop-1',
      period_label: 'Febrero 2024',
      period_start: '2024-02-01',
      period_end: '2024-02-29',
      status: 'published',
      created_by: 'agent-1',
      published_at: '2024-02-15T00:00:00.000Z',
      public_slug: 'libertador-100-febrero-2024-b1c2d3',
    })
    const draft = Report.create({
      id: 'report-3',
      property_id: 'prop-1',
      period_label: 'Marzo 2024',
      period_start: '2024-03-01',
      period_end: '2024-03-31',
      status: 'draft',
      created_by: 'agent-1',
      published_at: null,
      public_slug: 'libertador-100-marzo-draft',
    })
    const { propertyRepo, reportRepo, orgRepo, visitFormRepo } = makeRepos()
    reportRepo.findByOrg = vi.fn().mockResolvedValue([r1, r2, draft])
    const uc = new GetPublicReportUseCase(propertyRepo, reportRepo, orgRepo, visitFormRepo)
    const result = await uc.execute('av-libertador-100-enero-2024-a3f9b2')

    expect(result).not.toBeNull()
    expect(result!.available_reports).toHaveLength(2) // draft excluido
    // Más reciente primero (orden DESC por period_start)
    expect(result!.available_reports[0].slug).toBe('libertador-100-febrero-2024-b1c2d3')
    expect(result!.available_reports[0].is_current).toBe(false)
    expect(result!.available_reports[1].slug).toBe('av-libertador-100-enero-2024-a3f9b2')
    expect(result!.available_reports[1].is_current).toBe(true)
  })

  it('returns null when slug does not match any published report', async () => {
    const { propertyRepo, reportRepo, orgRepo, visitFormRepo } = makeRepos({
      reportFound: null,
    })
    const uc = new GetPublicReportUseCase(propertyRepo, reportRepo, orgRepo, visitFormRepo)
    const result = await uc.execute('no-such-slug')
    expect(result).toBeNull()
    expect(propertyRepo.findById).not.toHaveBeenCalled()
  })

  it('returns null when the linked property is missing', async () => {
    const { propertyRepo, reportRepo, orgRepo, visitFormRepo } = makeRepos({ property: null })
    const uc = new GetPublicReportUseCase(propertyRepo, reportRepo, orgRepo, visitFormRepo)
    const result = await uc.execute('av-libertador-100-enero-2024-a3f9b2')
    expect(result).toBeNull()
  })

  it('returns null when the org is missing', async () => {
    const { propertyRepo, reportRepo, orgRepo, visitFormRepo } = makeRepos({ org: null })
    const uc = new GetPublicReportUseCase(propertyRepo, reportRepo, orgRepo, visitFormRepo)
    const result = await uc.execute('av-libertador-100-enero-2024-a3f9b2')
    expect(result).toBeNull()
  })

  it('filters out non-submitted, archived and deleted visit forms', async () => {
    const submitted = PropertyVisitForm.create({
      id: 'vf-submitted',
      org_id: 'org-1',
      property_id: 'prop-1',
      agent_id: 'agent-1',
      slug: 'aaa',
      visitor_name: 'Ana',
      visitor_email: null,
      visitor_phone: null,
      rating: 5,
      liked: 'todo',
      disliked: null,
      subjective_price_usd: null,
      buy_intention: 'compraria',
      source: 'argenprop',
      situation: 'mudanza',
      observations: null,
      submitted_at: '2024-01-15T10:00:00.000Z',
    })
    const pending = PropertyVisitForm.create({
      id: 'vf-pending',
      org_id: 'org-1',
      property_id: 'prop-1',
      agent_id: 'agent-1',
      slug: 'bbb',
      visitor_name: null,
      visitor_email: null,
      visitor_phone: null,
      rating: null,
      liked: null,
      disliked: null,
      subjective_price_usd: null,
      buy_intention: null,
      source: null,
      situation: null,
      observations: null,
    })
    const archived = PropertyVisitForm.create({
      id: 'vf-archived',
      org_id: 'org-1',
      property_id: 'prop-1',
      agent_id: 'agent-1',
      slug: 'ccc',
      visitor_name: 'Bea',
      visitor_email: null,
      visitor_phone: null,
      rating: 3,
      liked: null,
      disliked: null,
      subjective_price_usd: null,
      buy_intention: null,
      source: null,
      situation: null,
      observations: null,
      submitted_at: '2024-01-10T10:00:00.000Z',
      archived_at: '2024-01-12T10:00:00.000Z',
    })
    const deleted = PropertyVisitForm.create({
      id: 'vf-deleted',
      org_id: 'org-1',
      property_id: 'prop-1',
      agent_id: 'agent-1',
      slug: 'ddd',
      visitor_name: 'Carlos',
      visitor_email: null,
      visitor_phone: null,
      rating: null,
      liked: null,
      disliked: null,
      subjective_price_usd: null,
      buy_intention: null,
      source: null,
      situation: null,
      observations: null,
      submitted_at: '2024-01-08T10:00:00.000Z',
      deleted_at: '2024-01-09T10:00:00.000Z',
    })
    const { propertyRepo, reportRepo, orgRepo, visitFormRepo } = makeRepos({
      visitForms: [submitted, pending, archived, deleted],
    })
    const uc = new GetPublicReportUseCase(propertyRepo, reportRepo, orgRepo, visitFormRepo)
    const result = await uc.execute('av-libertador-100-enero-2024-a3f9b2')

    expect(result).not.toBeNull()
    expect(result!.visit_forms).toHaveLength(1)
    expect(result!.visit_forms[0].id).toBe('vf-submitted')
    expect(result!.visit_forms[0].rating).toBe(5)
    expect(result!.visit_forms[0].source).toBe('argenprop')
  })
})
