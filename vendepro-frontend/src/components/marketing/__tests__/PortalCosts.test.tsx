import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import PortalCosts, { type PortalCostsData } from '../PortalCosts'

const apiFetch = vi.fn()
vi.mock('@/lib/api', () => ({ apiFetch: (...args: any[]) => apiFetch(...args) }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))

const toast = vi.fn()
vi.mock('@/components/ui/Toast', () => ({ useToast: () => ({ toast }) }))

let role = 'admin'
vi.mock('@/lib/auth', () => ({ getCurrentUser: () => ({ id: 'u1', role }) }))

// ZonaProp: 1000 USD sobre 40 leads = 25 por lead.
// MercadoLibre: trajo leads pero nadie cargó lo que se paga.
// Properati: gasto cargado en pesos que no se pudo cotizar.
const DATA: PortalCostsData = {
  rows: [
    {
      provider: 'zonaprop', label: null, spend_usd: 1000, months: 1, months_without_rate: 0,
      prorated: true, leads: 40, visitas: 8, ganados: 1,
      cost_per_lead_usd: 25, cost_per_visit_usd: 125, missing: null,
      income_usd: 6000, operations: 1, roi: 500, roas: 6,
    },
    {
      provider: 'properati', label: 'Properati', spend_usd: null, months: 1, months_without_rate: 1,
      prorated: false, leads: 5, visitas: 0, ganados: 0,
      cost_per_lead_usd: null, cost_per_visit_usd: null, missing: 'sin_cotizacion',
      income_usd: null, operations: 0, roi: null, roas: null,
    },
    {
      provider: 'mercadolibre', label: null, spend_usd: null, months: 0, months_without_rate: 0,
      prorated: false, leads: 20, visitas: 5, ganados: 0,
      cost_per_lead_usd: null, cost_per_visit_usd: null, missing: 'sin_gasto',
      income_usd: null, operations: 0, roi: null, roas: null,
    },
  ],
  summary: {
    spend_usd: 1000, leads: 65, visitas: 13, ganados: 1,
    cost_per_lead_usd: 15.38, pending_rate: 1, prorated: true,
    income_usd: 6000, operations: 1, roi: 500,
    unattributed_income_usd: 0, unattributed_operations: 0, income_pending_rate: 0,
  },
}

beforeEach(() => {
  vi.clearAllMocks()
  role = 'admin'
  apiFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve([]) })
})
afterEach(cleanup)

describe('Costo por portal', () => {
  it('muestra el costo por lead de cada portal', () => {
    render(<PortalCosts data={DATA} onChange={() => {}} />)
    expect(screen.getByText('ZonaProp')).toBeInTheDocument()
    expect(screen.getByText('US$ 25')).toBeInTheDocument()
    expect(screen.getByText('US$ 125')).toBeInTheDocument()
  })

  /**
   * El punto de toda la tabla: un portal que trajo leads pero no tiene el gasto
   * cargado tiene que aparecer igual, diciendo qué falta. Esconderlo deja al
   * usuario creyendo que la foto está completa.
   */
  it('lista los portales sin gasto cargado y explica qué falta', () => {
    render(<PortalCosts data={DATA} onChange={() => {}} />)
    expect(screen.getByText('MercadoLibre')).toBeInTheDocument()
    expect(screen.getByText('Falta cargar el gasto')).toBeInTheDocument()
  })

  it('no convierte un gasto sin cotización y avisa que quedó afuera del total', () => {
    render(<PortalCosts data={DATA} onChange={() => {}} />)
    expect(screen.getByText('Falta la cotización')).toBeInTheDocument()
    expect(screen.getByText('Falta la cotización del dólar')).toBeInTheDocument()
    expect(screen.getByText(/Un gasto quedó/)).toBeInTheDocument()
  })

  it('aclara que el gasto del período está prorrateado', () => {
    render(<PortalCosts data={DATA} onChange={() => {}} />)
    expect(screen.getByText(/se prorratea por los días del período/)).toBeInTheDocument()
  })

  // El ROI es el número que cierra todo: gastó 1000, entraron 6000 de
  // honorarios de la operación que ese portal trajo.
  it('muestra los honorarios atribuidos y el ROI del portal', () => {
    render(<PortalCosts data={DATA} onChange={() => {}} />)
    expect(screen.getAllByText('US$ 6.000').length).toBeGreaterThan(0)
    expect(screen.getAllByText('+500%').length).toBeGreaterThan(0)
  })

  it('un portal sin cierres no muestra ROI cero, muestra que no hay cierres', () => {
    render(<PortalCosts data={DATA} onChange={() => {}} />)
    expect(screen.getAllByText('Sin cierres').length).toBeGreaterThan(0)
  })

  it('avisa de los cierres que no se pudieron atribuir a ningún portal', () => {
    const data = {
      ...DATA,
      summary: { ...DATA.summary, unattributed_income_usd: 9000, unattributed_operations: 1 },
    }
    render(<PortalCosts data={data} onChange={() => {}} />)
    expect(screen.getByText('Cierres sin origen atribuido')).toBeInTheDocument()
    expect(screen.getByText(/no se pueden atribuir a ningún portal/)).toBeInTheDocument()
  })

  it('sin datos invita a cargar el primer gasto', () => {
    render(<PortalCosts data={{ rows: [], summary: { ...DATA.summary, spend_usd: null } }} onChange={() => {}} />)
    expect(screen.getByText('Todavía no hay datos de portales')).toBeInTheDocument()
  })

  // Marketing por usuario (08-sep): cada agente maneja su propio presupuesto,
  // así que ya no hay candado de admin. Antes esto probaba lo contrario.
  it('cualquier agente puede cargar su propio presupuesto', () => {
    role = 'agent'
    render(<PortalCosts data={DATA} onChange={() => {}} />)
    expect(screen.getByText('ZonaProp')).toBeInTheDocument()
    expect(screen.getByText('Cargar gasto')).toBeInTheDocument()
  })

  it('guarda el gasto del mes con su moneda', async () => {
    const onChange = vi.fn()
    render(<PortalCosts data={DATA} onChange={onChange} />)

    fireEvent.click(screen.getByText('Cargar gasto'))
    fireEvent.change(await screen.findByLabelText(/Portal/), { target: { value: 'zonaprop' } })
    fireEvent.change(screen.getByLabelText(/Mes/), { target: { value: '2026-09' } })
    fireEvent.change(screen.getByLabelText(/Importe del mes/), { target: { value: '1450000' } })

    apiFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ usd_rate: 1450 }) })
    fireEvent.click(screen.getByText('Guardar'))

    await waitFor(() => expect(onChange).toHaveBeenCalled())
    const put = apiFetch.mock.calls.find(c => c[2]?.method === 'PUT')
    expect(put?.[1]).toBe('/marketing/portal-spend')
    expect(JSON.parse(put![2].body)).toMatchObject({
      provider: 'zonaprop', period_month: '2026-09', amount: 1450000, currency: 'ARS', usd_rate: null,
    })
  })

  // Guardar sin cotización no es un error — el gasto se pierde si se rechaza —
  // pero el usuario tiene que enterarse de que le falta completarla.
  it('avisa cuando el gasto se guardó sin cotización', async () => {
    render(<PortalCosts data={DATA} onChange={() => {}} />)
    fireEvent.click(screen.getByText('Cargar gasto'))
    fireEvent.change(await screen.findByLabelText(/Portal/), { target: { value: 'zonaprop' } })
    fireEvent.change(screen.getByLabelText(/Importe del mes/), { target: { value: '1000' } })

    apiFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ usd_rate: null }) })
    fireEvent.click(screen.getByText('Guardar'))

    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.stringMatching(/cotización/i), 'error'))
  })

  it('un importe vacío no se guarda como cero', async () => {
    render(<PortalCosts data={DATA} onChange={() => {}} />)
    fireEvent.click(screen.getByText('Cargar gasto'))
    fireEvent.change(await screen.findByLabelText(/Portal/), { target: { value: 'zonaprop' } })
    fireEvent.click(screen.getByText('Guardar'))

    await waitFor(() => expect(toast).toHaveBeenCalledWith('Cargá el importe del mes', 'error'))
    expect(apiFetch.mock.calls.some(c => c[2]?.method === 'PUT')).toBe(false)
  })
})
