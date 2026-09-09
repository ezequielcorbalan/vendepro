import type { FunnelPipeline } from '../rules/lead-rules'

/**
 * Objetivo comercial de una campaña de pauta.
 *
 * No es el `objective` de Meta (que dice cómo optimiza), sino para qué la usa
 * la inmobiliaria: traer propietarios o traer compradores. Lo etiqueta el
 * usuario porque ninguna plataforma lo sabe.
 */
export const CAMPAIGN_GOALS = ['captacion', 'demanda'] as const
export type CampaignGoal = (typeof CAMPAIGN_GOALS)[number]

export function isCampaignGoal(value: unknown): value is CampaignGoal {
  return typeof value === 'string' && (CAMPAIGN_GOALS as readonly string[]).includes(value)
}

/** El objetivo que le corresponde a cada sección del panel. */
const GOAL_BY_PIPELINE: Record<FunnelPipeline, CampaignGoal> = {
  vendedor: 'captacion',
  comprador: 'demanda',
}

export function goalForPipeline(pipeline: FunnelPipeline): CampaignGoal {
  return GOAL_BY_PIPELINE[pipeline]
}

export interface CampaignWithGoal {
  campaign_id: string
  spend: number
}

export interface SplitCampaignsResult<T extends CampaignWithGoal> {
  /** Campañas de la sección pedida. */
  matching: T[]
  /** Campañas todavía sin etiquetar: no cuentan en ninguna sección. */
  unclassified: T[]
  /** Gasto suelto que está quedando afuera de los totales. */
  unclassified_spend: number
}

/**
 * Parte las campañas en las de esta sección y las que faltan etiquetar.
 *
 * Una campaña sin etiqueta NO se reparte en las dos: contar el mismo gasto dos
 * veces dejaría el costo por captación a la mitad del real. Queda aparte, con
 * su gasto a la vista, para que se note que falta clasificarla.
 */
export function splitCampaignsByGoal<T extends CampaignWithGoal>(
  campaigns: T[],
  goals: Map<string, CampaignGoal>,
  wanted: CampaignGoal,
): SplitCampaignsResult<T> {
  const matching: T[] = []
  const unclassified: T[] = []

  for (const c of campaigns) {
    const goal = goals.get(c.campaign_id)
    if (goal === undefined) unclassified.push(c)
    else if (goal === wanted) matching.push(c)
    // Las del otro objetivo simplemente no van en esta sección.
  }

  return {
    matching,
    unclassified,
    unclassified_spend: Math.round(unclassified.reduce((a, c) => a + c.spend, 0) * 100) / 100,
  }
}
