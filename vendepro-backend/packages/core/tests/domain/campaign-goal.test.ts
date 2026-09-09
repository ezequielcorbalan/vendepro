import { describe, it, expect } from 'vitest'
import {
  isCampaignGoal,
  goalForPipeline,
  splitCampaignsByGoal,
  type CampaignGoal,
} from '../../src/domain/value-objects/campaign-goal'

const CAMPAIGNS = [
  { campaign_id: 'c1', spend: 1000 },  // captación
  { campaign_id: 'c2', spend: 500 },   // demanda
  { campaign_id: 'c3', spend: 250 },   // sin etiquetar
  { campaign_id: 'c4', spend: 125.5 }, // sin etiquetar
]

const GOALS = new Map<string, CampaignGoal>([
  ['c1', 'captacion'],
  ['c2', 'demanda'],
])

describe('isCampaignGoal', () => {
  it('acepta sólo los dos objetivos', () => {
    expect(isCampaignGoal('captacion')).toBe(true)
    expect(isCampaignGoal('demanda')).toBe(true)
    expect(isCampaignGoal('ambas')).toBe(false)
    expect(isCampaignGoal(null)).toBe(false)
  })
})

describe('goalForPipeline', () => {
  it('mapea cada sección del panel a su objetivo', () => {
    expect(goalForPipeline('vendedor')).toBe('captacion')
    expect(goalForPipeline('comprador')).toBe('demanda')
  })
})

describe('splitCampaignsByGoal', () => {
  it('devuelve sólo las campañas de la sección pedida', () => {
    expect(splitCampaignsByGoal(CAMPAIGNS, GOALS, 'captacion').matching.map(c => c.campaign_id)).toEqual(['c1'])
    expect(splitCampaignsByGoal(CAMPAIGNS, GOALS, 'demanda').matching.map(c => c.campaign_id)).toEqual(['c2'])
  })

  /**
   * La regla que sostiene todo: una campaña sin etiqueta NO se reparte en las
   * dos secciones. Contar el mismo gasto dos veces dejaría el costo por
   * captación a la mitad del real, que es exactamente el tipo de número
   * silenciosamente falso que este trabajo vino a sacar de la pantalla.
   */
  it('las campañas sin etiquetar no entran en ninguna sección', () => {
    for (const goal of ['captacion', 'demanda'] as const) {
      const r = splitCampaignsByGoal(CAMPAIGNS, GOALS, goal)
      expect(r.matching.map(c => c.campaign_id)).not.toContain('c3')
      expect(r.matching.map(c => c.campaign_id)).not.toContain('c4')
    }
  })

  it('deja las sin etiquetar aparte, con su gasto a la vista', () => {
    const r = splitCampaignsByGoal(CAMPAIGNS, GOALS, 'captacion')
    expect(r.unclassified.map(c => c.campaign_id)).toEqual(['c3', 'c4'])
    expect(r.unclassified_spend).toBe(375.5)
  })

  it('la bandeja de sin clasificar es la misma en las dos secciones', () => {
    const cap = splitCampaignsByGoal(CAMPAIGNS, GOALS, 'captacion')
    const dem = splitCampaignsByGoal(CAMPAIGNS, GOALS, 'demanda')
    expect(cap.unclassified).toEqual(dem.unclassified)
  })

  it('sin ninguna etiqueta cargada, todo queda sin clasificar', () => {
    const r = splitCampaignsByGoal(CAMPAIGNS, new Map(), 'captacion')
    expect(r.matching).toEqual([])
    expect(r.unclassified).toHaveLength(4)
    expect(r.unclassified_spend).toBe(1875.5)
  })

  it('con todo etiquetado la bandeja queda vacía y el gasto suelto en cero', () => {
    const goals = new Map<string, CampaignGoal>([
      ['c1', 'captacion'], ['c2', 'demanda'], ['c3', 'captacion'], ['c4', 'demanda'],
    ])
    const r = splitCampaignsByGoal(CAMPAIGNS, goals, 'captacion')
    expect(r.matching.map(c => c.campaign_id)).toEqual(['c1', 'c3'])
    expect(r.unclassified).toEqual([])
    expect(r.unclassified_spend).toBe(0)
  })

  it('sin campañas no rompe', () => {
    const r = splitCampaignsByGoal([], GOALS, 'captacion')
    expect(r).toEqual({ matching: [], unclassified: [], unclassified_spend: 0 })
  })
})
