/**
 * Módulos comerciales del plan.
 *
 * El catálogo y el estado los sirve `GET /modules` de api-admin — acá no se
 * duplica la regla de negocio, sólo los tipos y el helper de lectura. Un
 * módulo está habilitado si vino en `enabled`; el backend ya resolvió el
 * cruce entre el plan contratado y la activación manual.
 */

export const ORG_MODULES = ['publicidad', 'emails', 'landings', 'automatizaciones'] as const
export type OrgModule = (typeof ORG_MODULES)[number]

export type OrgPlan = 'basic' | 'pro'

export interface ModuleDefinition {
  key: OrgModule
  label: string
  description: string
  plan: OrgPlan
}

export interface OrgModulesState {
  plan: OrgPlan
  /** Activados a mano, sin cruzar con el plan. */
  modules: OrgModule[]
  /** Los que realmente se pueden usar: plan + activación. */
  enabled: OrgModule[]
  catalog: ModuleDefinition[]
}

/**
 * Estado por defecto cuando no se pudo leer el plan (API caída, red cortada).
 *
 * Abre en vez de cerrar: dejar a un cliente que paga sin su módulo por un
 * error de red es peor que mostrarle de más a uno que no lo tiene. La barrera
 * comercial de verdad tiene que vivir en las APIs, no en este fallback.
 */
export const MODULES_FALLBACK: OrgModulesState = {
  plan: 'pro',
  modules: [...ORG_MODULES],
  enabled: [...ORG_MODULES],
  catalog: [],
}

export function hasModule(state: OrgModulesState | null, key: OrgModule): boolean {
  if (!state) return true // mismo criterio que el fallback: no bloquear sin datos
  return state.enabled.includes(key)
}

export function moduleDefinition(state: OrgModulesState | null, key: OrgModule): ModuleDefinition | null {
  return state?.catalog.find(m => m.key === key) ?? null
}
