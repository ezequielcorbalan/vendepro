import { describe, it, expect } from 'vitest'
import {
  computeRealLeadFunnel,
  computeCaptureTail,
  type FunnelLead,
  type FunnelHistoryEntry,
} from '../../src/domain/rules/lead-funnel-rules'

const lead = (id: string, stage: string, created_at = '2026-01-01T00:00:00.000Z'): FunnelLead =>
  ({ id, stage, created_at })

const step = (entity_id: string, to_stage: string, changed_at: string): FunnelHistoryEntry =>
  ({ entity_id, to_stage, changed_at })

const byKey = (result: ReturnType<typeof computeRealLeadFunnel>) =>
  Object.fromEntries(result.stages.map(s => [s.stage, s.count]))

describe('computeRealLeadFunnel', () => {
  it('cuenta las etapas por las que pasó, no dónde está parado', () => {
    // Este es el bug que arregla: antes un lead captado contaba SÓLO en
    // "captado" y desaparecía de las etapas anteriores.
    const leads = [lead('l1', 'captado')]
    const history = [
      step('l1', 'contactado', '2026-01-02T00:00:00.000Z'),
      step('l1', 'calificado', '2026-01-03T00:00:00.000Z'),
      step('l1', 'en_tasacion', '2026-01-04T00:00:00.000Z'),
      step('l1', 'presentada', '2026-01-05T00:00:00.000Z'),
      step('l1', 'captado', '2026-01-06T00:00:00.000Z'),
    ]

    const counts = byKey(computeRealLeadFunnel(leads, history))
    expect(counts.nuevo).toBe(1)
    expect(counts.contactado).toBe(1)
    expect(counts.captado).toBe(1)
  })

  it('nunca produce un embudo que crece', () => {
    // La propiedad que define un embudo: nadie llega a una etapa sin haber
    // pasado por la anterior. El widget viejo la rompía a diario.
    const leads = [
      lead('l1', 'captado'), lead('l2', 'presentada'), lead('l3', 'contactado'),
      lead('l4', 'nuevo'), lead('l5', 'perdido'), lead('l6', 'seguimiento'),
    ]
    const history = [
      step('l5', 'contactado', '2026-01-02T00:00:00.000Z'),
      step('l6', 'contactado', '2026-01-02T00:00:00.000Z'),
      step('l6', 'seguimiento', '2026-01-03T00:00:00.000Z'),
    ]

    const { stages } = computeRealLeadFunnel(leads, history)
    for (let i = 1; i < stages.length; i++) {
      expect(stages[i]!.count).toBeLessThanOrEqual(stages[i - 1]!.count)
    }
  })

  it('infiere las etapas anteriores de un lead importado sin historial', () => {
    // Los 194 leads que ya estaban en la base no tienen historial. Sin este
    // relleno el embudo mostraría casi todo en cero, peor que lo que había.
    const counts = byKey(computeRealLeadFunnel([lead('l1', 'presentada')], []))
    expect(counts.nuevo).toBe(1)
    expect(counts.contactado).toBe(1)
    expect(counts.presentada).toBe(1)
    expect(counts.captado).toBe(0)
  })

  it('no inventa avance para un lead perdido sin historial', () => {
    // Desde "perdido" no se puede afirmar hasta dónde había llegado.
    const counts = byKey(computeRealLeadFunnel([lead('l1', 'perdido')], []))
    expect(counts.nuevo).toBe(1)
    expect(counts.contactado).toBe(0)
  })

  it('usa el historial de un lead perdido para saber hasta dónde llegó', () => {
    const counts = byKey(computeRealLeadFunnel(
      [lead('l1', 'perdido')],
      [step('l1', 'contactado', '2026-01-02T00:00:00.000Z'),
       step('l1', 'calificado', '2026-01-03T00:00:00.000Z')],
    ))
    expect(counts.calificado).toBe(1)
    expect(counts.en_tasacion).toBe(0)
  })

  it('calcula la conversión del paso, no sólo la del total', () => {
    const leads = [lead('l1', 'contactado'), lead('l2', 'contactado'), lead('l3', 'nuevo'), lead('l4', 'nuevo')]
    const { stages } = computeRealLeadFunnel(leads, [])
    const contactado = stages.find(s => s.stage === 'contactado')!
    expect(contactado.pct).toBe(50)      // sobre los 4 que entraron
    expect(contactado.step_pct).toBe(50) // sobre los 4 que pasaron por "nuevo"
  })

  it('mide los días medianos entre etapas', () => {
    const leads = [lead('l1', 'contactado'), lead('l2', 'contactado'), lead('l3', 'contactado')]
    const history = [
      step('l1', 'nuevo', '2026-01-01T00:00:00.000Z'),
      step('l1', 'contactado', '2026-01-03T00:00:00.000Z'), // 2 días
      step('l2', 'nuevo', '2026-01-01T00:00:00.000Z'),
      step('l2', 'contactado', '2026-01-05T00:00:00.000Z'), // 4 días
      step('l3', 'nuevo', '2026-01-01T00:00:00.000Z'),
      step('l3', 'contactado', '2026-01-10T00:00:00.000Z'), // 9 días
    ]

    const contactado = computeRealLeadFunnel(leads, history).stages
      .find(s => s.stage === 'contactado')!
    expect(contactado.median_days_from_prev).toBe(4)
    expect(contactado.timed_on).toBe(3)
  })

  it('deja el tiempo en null cuando no hay fechas de las dos puntas', () => {
    // Lead importado: alcanzó la etapa, pero no se sabe cuándo.
    const contactado = computeRealLeadFunnel([lead('l1', 'contactado')], []).stages
      .find(s => s.stage === 'contactado')!
    expect(contactado.median_days_from_prev).toBeNull()
    expect(contactado.timed_on).toBe(0)
  })

  it('se queda con la primera vez que alcanzó la etapa', () => {
    // Un lead que vuelve a seguimiento y avanza otra vez no reinicia el reloj.
    const history = [
      step('l1', 'nuevo', '2026-01-01T00:00:00.000Z'),
      step('l1', 'contactado', '2026-01-03T00:00:00.000Z'),
      step('l1', 'seguimiento', '2026-01-10T00:00:00.000Z'),
      step('l1', 'contactado', '2026-01-20T00:00:00.000Z'),
    ]
    const contactado = computeRealLeadFunnel([lead('l1', 'contactado')], history).stages
      .find(s => s.stage === 'contactado')!
    expect(contactado.median_days_from_prev).toBe(2)
  })

  it('informa cuántos leads tienen historial', () => {
    const result = computeRealLeadFunnel(
      [lead('l1', 'contactado'), lead('l2', 'nuevo')],
      [step('l1', 'contactado', '2026-01-02T00:00:00.000Z')],
    )
    expect(result.total).toBe(2)
    expect(result.with_history).toBe(1)
  })

  it('sirve también para el pipeline comprador', () => {
    const counts = byKey(computeRealLeadFunnel([lead('l1', 'oferta')], [], 'comprador'))
    expect(counts.visita_agendada).toBe(1)
    expect(counts.visito).toBe(1)
    expect(counts.oferta).toBe(1)
    expect(counts.cerrado).toBe(0)
  })

  it('no se cae con cero leads', () => {
    const result = computeRealLeadFunnel([], [])
    expect(result.total).toBe(0)
    expect(result.stages.every(s => s.count === 0 && s.pct === 0)).toBe(true)
  })

  it('descarta una transición con fecha hacia atrás en vez de contarla como 0 días', () => {
    const history = [
      step('l1', 'nuevo', '2026-01-10T00:00:00.000Z'),
      step('l1', 'contactado', '2026-01-01T00:00:00.000Z'),
    ]
    const contactado = computeRealLeadFunnel([lead('l1', 'contactado')], history).stages
      .find(s => s.stage === 'contactado')!
    expect(contactado.timed_on).toBe(0)
    expect(contactado.median_days_from_prev).toBeNull()
  })
})

describe('computeCaptureTail', () => {
  const prop = (id: string, lead_id: string | null, commercial_stage: string | null) =>
    ({ id, lead_id, commercial_stage })

  it('sigue a la propiedad que salió de cada lead captado', () => {
    const captados = new Set(['l1', 'l2', 'l3'])
    const props = [
      prop('p1', 'l1', 'vendida'),
      prop('p2', 'l2', 'publicada'),
      prop('p3', 'l3', 'captada'),
    ]

    const { stages, captured, traced } = computeCaptureTail(captados, props, [])
    expect(captured).toBe(3)
    expect(traced).toBe(3)
    const byKey = Object.fromEntries(stages.map(s => [s.stage, s.count]))
    expect(byKey.reservada).toBe(1) // sólo la vendida pasó por acá
    expect(byKey.vendida).toBe(1)
  })

  it('publicada no es un escalón: publicar es consecuencia de captar', () => {
    // Como filtro no separa nada — toda captación se publica.
    const props = [prop('p1', 'l1', 'publicada'), prop('p2', 'l2', 'captada')]
    const { stages } = computeCaptureTail(new Set(['l1', 'l2']), props, [])

    expect(stages.map(s => s.stage)).toEqual(['reservada', 'vendida'])
    // Una publicada todavía no se reservó: no suma a ningún escalón.
    expect(stages.every(s => s.count === 0)).toBe(true)
  })

  it('ignora las propiedades que no salieron de un lead captado del período', () => {
    // Sumarlas sería mezclar poblaciones — el error que el embudo viejo hacía.
    const captados = new Set(['l1'])
    const props = [
      prop('p1', 'l1', 'vendida'),
      prop('p2', 'otro-lead', 'vendida'),
      prop('p3', null, 'vendida'), // cargada suelta
    ]

    const { stages, traced } = computeCaptureTail(captados, props, [])
    expect(traced).toBe(1)
    expect(stages.find(s => s.stage === 'vendida')!.count).toBe(1)
  })

  it('mide el porcentaje sobre los leads captados, no sobre las propiedades', () => {
    // "De lo que captamos, cuánto se vendió" es la pregunta del usuario.
    const captados = new Set(['l1', 'l2', 'l3', 'l4'])
    const props = [prop('p1', 'l1', 'vendida')]

    const vendida = computeCaptureTail(captados, props, []).stages
      .find(s => s.stage === 'vendida')!
    expect(vendida.pct).toBe(25)
  })

  it('no infiere avance desde una etapa de cierre de la propiedad', () => {
    const captados = new Set(['l1'])
    const props = [prop('p1', 'l1', 'perdida')]

    const { stages } = computeCaptureTail(captados, props, [])
    expect(stages.every(s => s.count === 0)).toBe(true)
  })

  it('usa el historial de la propiedad cuando existe', () => {
    const captados = new Set(['l1'])
    const props = [prop('p1', 'l1', 'perdida')]
    const history = [
      step('p1', 'publicada', '2026-02-01T00:00:00.000Z'),
      step('p1', 'reservada', '2026-02-11T00:00:00.000Z'),
    ]

    const { stages } = computeCaptureTail(captados, props, history)
    const byKey = Object.fromEntries(stages.map(s => [s.stage, s.count]))
    expect(byKey.reservada).toBe(1)
    expect(byKey.vendida).toBe(0)
  })

  it('avisa cuántos captados tienen propiedad vinculada', () => {
    // Sin esto, "0 publicadas" se lee como "no publicamos nada" cuando lo que
    // pasó es que la propiedad se cargó sin vincular al lead.
    const { captured, traced } = computeCaptureTail(new Set(['l1', 'l2', 'l3']), [], [])
    expect(captured).toBe(3)
    expect(traced).toBe(0)
  })

  it('nunca crece', () => {
    const captados = new Set(['l1', 'l2', 'l3'])
    const props = [
      prop('p1', 'l1', 'vendida'),
      prop('p2', 'l2', 'reservada'),
      prop('p3', 'l3', 'publicada'),
    ]
    const { stages } = computeCaptureTail(captados, props, [])
    for (let i = 1; i < stages.length; i++) {
      expect(stages[i]!.count).toBeLessThanOrEqual(stages[i - 1]!.count)
    }
  })

  it('no se cae sin leads captados', () => {
    const { stages, captured } = computeCaptureTail(new Set(), [], [])
    expect(captured).toBe(0)
    expect(stages.every(s => s.count === 0 && s.pct === 0)).toBe(true)
  })
})
