import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent, cleanup, within } from '@testing-library/react'
import MarketingPage from '../page'

const apiFetch = vi.fn()
vi.mock('@/lib/api', () => ({ apiFetch: (...args: any[]) => apiFetch(...args) }))
vi.mock('next/link', () => ({ default: ({ children, href }: any) => <a href={href}>{children}</a> }))
// La Table del DS usa useRouter para el modo `rowHref`.
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('@/lib/auth', () => ({ getCurrentUser: () => ({ id: 'u1', role: 'admin' }) }))
vi.mock('@/components/ui/Toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))
// El gate de plan no es lo que se está probando acá.
vi.mock('@/components/modules/ModuleGate', () => ({
  ModuleGate: ({ children }: any) => <>{children}</>,
}))

// Captación: 12 leads, 3 captados. La suma de fuentes da 12 — el mismo número
// que el KPI. Ese era el bug: el KPI contaba vendedores y las fuentes, todos.
const VENDEDOR = {
  pipeline: 'vendedor',
  goal_stage: 'captado',
  range: { from: '2026-09-01', to: '2026-09-04', previous_from: '2026-08-01', previous_to: '2026-08-04', elapsed_days: 3 },
  totals: { leads: 12, goal: 3, conversionRate: 25 },
  previous: { leads: 16, goal: 2, conversionRate: 12.5 },
  deltas: { leads: -25, goal: 50, conversionRatePoints: 12.5 },
  funnel: [
    { stage: 'nuevo', label: 'Nuevo', count: 12, pct: 100 },
    { stage: 'contactado', label: 'Contactado', count: 8, pct: 67 },
    { stage: 'captado', label: 'Captado', count: 3, pct: 25 },
  ],
  leadsBySource: [
    { source: 'landing:tasacion-palermo', count: 7 },
    { source: 'referido', count: 5 },
  ],
  leadsByDay: [{ day: '2026-09-01', count: 4 }, { day: '2026-09-02', count: 5 }, { day: '2026-09-03', count: 3 }],
  metaEvents: { Lead: { sent: 9, failed: 0 } },
  integration: {
    meta: { enabled: true, pixelId: '123' },
    ga4: { enabled: true, measurementId: 'G-1' },
  },
}

const COMPRADOR = {
  ...VENDEDOR,
  pipeline: 'comprador',
  goal_stage: 'cerrado',
  totals: { leads: 30, goal: 1, conversionRate: 3.3 },
  previous: { leads: 0, goal: 0, conversionRate: 0 },
  deltas: { leads: null, goal: null, conversionRatePoints: 3.3 },
  funnel: [
    { stage: 'nuevo', label: 'Nuevo', count: 30, pct: 100 },
    { stage: 'visita_agendada', label: 'Visita agendada', count: 6, pct: 20 },
    { stage: 'cerrado', label: 'Cerrado', count: 1, pct: 3 },
  ],
  leadsBySource: [
    { source: 'zonaprop', count: 18 },
    { source: 'mercadolibre', count: 12 },
  ],
  portalCosts: {
    rows: [{
      provider: 'zonaprop', label: null, spend_usd: 1000, months: 1, months_without_rate: 0,
      prorated: false, leads: 18, visitas: 4, ganados: 1,
      cost_per_lead_usd: 55.56, cost_per_visit_usd: 250, missing: null,
    }],
    summary: {
      spend_usd: 1000, leads: 30, visitas: 4, ganados: 1,
      cost_per_lead_usd: 33.33, pending_rate: 0, prorated: false,
    },
  },
}

const CAMPAIGNS = {
  status: 'ok',
  error: null,
  campaigns: [
    {
      campaign_id: 'c1', campaign_name: 'Tasaciones Palermo',
      spend: 120000, impressions: 40000, clicks: 800, leads: 20,
      account_currency: 'ARS',
      crm_leads: 10, crm_calificados: 6, crm_ganados: 2,
      cpl_crm: 12000, cpl_meta: 6000, goal: 'captacion',
    },
  ],
  unclassified: [
    {
      campaign_id: 'c9', campaign_name: 'Remarketing general',
      spend: 30000, impressions: 5000, clicks: 90, leads: 2,
      account_currency: 'ARS',
      crm_leads: 0, crm_calificados: 0, crm_ganados: 0,
      cpl_crm: null, cpl_meta: 15000, goal: null,
    },
  ],
  unclassified_spend: 30000,
}

function json(data: any) {
  return Promise.resolve({ json: () => Promise.resolve(data) })
}

beforeEach(() => {
  vi.clearAllMocks()
  apiFetch.mockImplementation((_api: string, path: string) => {
    if (path.startsWith('/marketing/campaigns')) return json(CAMPAIGNS)
    if (path.includes('pipeline=comprador')) return json(COMPRADOR)
    return json(VENDEDOR)
  })
})

afterEach(cleanup)

const paths = () => apiFetch.mock.calls.map(c => c[1] as string)

describe('Panel de Marketing — Captación', () => {
  it('pide los datos filtrados por pipeline vendedor', async () => {
    render(<MarketingPage />)
    await screen.findByText('Tasaciones Palermo')
    expect(paths()).toContain('/marketing?period=month&pipeline=vendedor')
  })

  it('el total del KPI coincide con la suma de las fuentes', async () => {
    render(<MarketingPage />)
    await screen.findByText('Tasaciones Palermo')

    // KPI de leads: 12, dentro de su propia tarjeta
    const kpi = screen.getByText('Leads del período').parentElement!.parentElement!
    expect(within(kpi).getByText('12')).toBeInTheDocument()
    // Fuentes: 7 (58%) + 5 (42%) = 12 leads y 100%
    expect(screen.getByText('7 · 58%')).toBeInTheDocument()
    expect(screen.getByText('5 · 42%')).toBeInTheDocument()
  })

  it('muestra el rango comparado en el subtítulo', async () => {
    render(<MarketingPage />)
    const subtitle = await screen.findAllByText('1 sep – 3 sep · comparado con 1 ago – 3 ago')
    expect(subtitle.length).toBeGreaterThan(0)
  })

  it('las variaciones son contra el período anterior, no contra un umbral fijo', async () => {
    render(<MarketingPage />)
    await screen.findByText('Tasaciones Palermo')
    expect(screen.getByText('-25%')).toBeInTheDocument()      // 12 leads vs 16
    expect(screen.getByText('vs 16')).toBeInTheDocument()
    expect(screen.getByText('+50%')).toBeInTheDocument()      // 3 captados vs 2
    // Una tasa se compara en puntos, no en variación porcentual.
    expect(screen.getByText('+12,5 pts')).toBeInTheDocument()
  })

  it('los leads de landing se leen, no salen como texto crudo', async () => {
    render(<MarketingPage />)
    await screen.findByText('Landing · tasacion-palermo')
  })

  it('el CPL viaja con su base declarada, en dos columnas', async () => {
    render(<MarketingPage />)
    await screen.findByText('Tasaciones Palermo')
    expect(screen.getByText('CPL (CRM)')).toBeInTheDocument()
    expect(screen.getByText('CPL (Meta)')).toBeInTheDocument()
  })

  it('no promete exportar audiencias que no se exportan', async () => {
    render(<MarketingPage />)
    await screen.findByText('Tasaciones Palermo')
    expect(screen.queryByText('Audiencias sugeridas')).not.toBeInTheDocument()
    expect(screen.queryByText(/Exportar/)).not.toBeInTheDocument()
  })
})

describe('Panel de Marketing — Demanda', () => {
  async function goToDemanda() {
    render(<MarketingPage />)
    await screen.findByText('Tasaciones Palermo')
    fireEvent.click(screen.getByRole('tab', { name: 'Demanda' }))
    await screen.findByText('Visita agendada')
  }

  it('cambia el pipeline de todas las series', async () => {
    await goToDemanda()
    expect(paths()).toContain('/marketing?period=month&pipeline=comprador')
    expect(screen.getAllByText('MercadoLibre').length).toBeGreaterThan(0)
  })

  it('el embudo y el objetivo son los del comprador', async () => {
    await goToDemanda()
    expect(screen.getByText('Visita agendada')).toBeInTheDocument()
    expect(screen.getAllByText('Cerrados').length).toBeGreaterThan(0)
    expect(screen.queryByText('Captados')).not.toBeInTheDocument()
  })

  it('sin período anterior no inventa una variación', async () => {
    await goToDemanda()
    expect(screen.getAllByText('sin base previa').length).toBeGreaterThan(0)
  })

  it('pide las campañas de esta sección, no las de la otra', async () => {
    await goToDemanda()
    expect(paths()).toContain('/marketing/campaigns?period=month&pipeline=comprador')
  })

  it('muestra el costo por portal', async () => {
    await goToDemanda()
    expect(screen.getByText('Costo por portal')).toBeInTheDocument()
  })
})
