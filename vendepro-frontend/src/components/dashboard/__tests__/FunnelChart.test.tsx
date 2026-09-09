import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { FunnelChart, type FunnelStage } from '../FunnelChart'

afterEach(cleanup)

const stage = (over: Partial<FunnelStage> & { stage: string; label: string; count: number }): FunnelStage => ({
  pct: 0, step_pct: 0, median_days_from_prev: null, timed_on: 0, ...over,
})

/** Un embudo de leads como el que devuelve la API. */
const LEAD_STAGES: FunnelStage[] = [
  stage({ stage: 'nuevo', label: 'Nuevo', count: 204, pct: 100, step_pct: 100 }),
  stage({ stage: 'contactado', label: 'Contactado', count: 162, pct: 79, step_pct: 79, median_days_from_prev: 0.9, timed_on: 128 }),
  stage({ stage: 'captado', label: 'Captado', count: 30, pct: 15, step_pct: 51 }),
]

/** La cola: lo que pasó con la propiedad después de captar. */
const PROPERTY_STAGES_DATA: FunnelStage[] = [
  stage({ stage: 'publicada', label: 'Publicada', count: 22, pct: 73, step_pct: 73 }),
  stage({ stage: 'reservada', label: 'Reservada', count: 8, pct: 27, step_pct: 36, median_days_from_prev: 41, timed_on: 8 }),
  stage({ stage: 'vendida', label: 'Vendida', count: 5, pct: 17, step_pct: 63 }),
]

describe('FunnelChart', () => {
  it('muestra el label de la etapa, no la clave cruda', () => {
    // El gráfico viejo imprimía `en_tasacion` tal cual salía de la base.
    render(<FunnelChart stages={[stage({ stage: 'en_tasacion', label: 'En tasación', count: 8 })]} total={10} />)
    expect(screen.getByText('En tasación')).toBeTruthy()
    expect(screen.queryByText('en_tasacion')).toBeNull()
  })

  it('dibuja las barras proporcionales al total, no a la barra más alta', () => {
    // Si se escalara al máximo, un embudo con poca caída y uno con mucha se
    // dibujarían igual — y la forma es justamente lo que hay que ver.
    const { container } = render(<FunnelChart stages={LEAD_STAGES} total={204} />)
    const anchos = [...container.querySelectorAll<HTMLElement>('[style*="width"]')]
      .map(el => parseFloat(el.style.width))

    expect(anchos[0]).toBe(100)              // 204/204
    expect(Math.round(anchos[1]!)).toBe(79)  // 162/204
    expect(Math.round(anchos[2]!)).toBe(15)  // 30/204
  })

  it('las barras nunca crecen hacia abajo', () => {
    const { container } = render(<FunnelChart stages={LEAD_STAGES} total={204} />)
    const anchos = [...container.querySelectorAll<HTMLElement>('[style*="width"]')]
      .map(el => parseFloat(el.style.width))
    for (let i = 1; i < anchos.length; i++) {
      expect(anchos[i]).toBeLessThanOrEqual(anchos[i - 1]!)
    }
  })

  it('muestra la conversión del paso entre etapa y etapa', () => {
    render(<FunnelChart stages={LEAD_STAGES} total={204} />)
    expect(screen.getByText(/79% pasa/)).toBeTruthy()
    expect(screen.getByText(/51% pasa/)).toBeTruthy()
  })

  it('agrega los días medianos sólo cuando hay dato', () => {
    render(<FunnelChart stages={LEAD_STAGES} total={204} />)
    // Contactado tiene tiempo medido; Captado no.
    expect(screen.getByText(/79% pasa · 0\.9 d/)).toBeTruthy()
    expect(screen.getByText(/^51% pasa$/)).toBeTruthy()
  })

  it('la primera etapa no lleva conector: no hay paso antes de entrar', () => {
    render(<FunnelChart stages={LEAD_STAGES} total={204} />)
    expect(screen.queryByText(/100% pasa/)).toBeNull()
  })

  it('colorea las etapas de propiedad con su propio mapa de dominio', () => {
    // Sin esto caían al gris del fallback de etapas de lead, y la cola se veía
    // apagada al lado del embudo de arriba.
    const { container } = render(
      <FunnelChart stages={PROPERTY_STAGES_DATA} total={30} domain="property" />,
    )
    const barras = [...container.querySelectorAll<HTMLElement>('[style*="width"]')]
    expect(barras[0]!.className).toMatch(/bg-blue-100/)    // publicada
    expect(barras[1]!.className).toMatch(/bg-purple-100/)  // reservada
    expect(barras[2]!.className).toMatch(/bg-emerald-100/) // vendida
  })

  it('mide la cola sobre los leads captados, no sobre las propiedades', () => {
    render(<FunnelChart stages={PROPERTY_STAGES_DATA} total={30} domain="property" />)
    // "De los 30 captados, 5 se vendieron" = 17%.
    expect(screen.getByText('17%')).toBeTruthy()
  })

  it('no se cae sin etapas', () => {
    const { container } = render(<FunnelChart stages={[]} total={0} />)
    expect(container.querySelectorAll('[style*="width"]')).toHaveLength(0)
  })
})
