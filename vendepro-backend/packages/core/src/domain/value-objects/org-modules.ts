/**
 * Módulos comerciales de VendéPro.
 *
 * La sección de Marketing es parte del plan PRO y, dentro de ese plan, cada
 * módulo se activa a mano. Son dos condiciones distintas a propósito: `plan`
 * dice qué contrató la inmobiliaria, `modules` qué se le habilitó de verdad.
 * Sirve para dar de alta un módulo por vez (una prueba, una migración
 * escalonada) sin regalar el resto del plan.
 *
 * Esto es la fuente de verdad: el endpoint que consume el frontend lo sirve
 * tal cual, y el menú lateral se arma con estas claves.
 */

export const ORG_PLANS = ['basic', 'pro'] as const
export type OrgPlan = (typeof ORG_PLANS)[number]

export const ORG_MODULES = ['publicidad', 'emails', 'landings', 'automatizaciones'] as const
export type OrgModule = (typeof ORG_MODULES)[number]

export interface ModuleDefinition {
  key: OrgModule
  label: string
  /** Una línea, la que se muestra en la pantalla de upsell. */
  description: string
  /** Plan mínimo que lo habilita. */
  plan: OrgPlan
}

export const MODULE_DEFINITIONS: readonly ModuleDefinition[] = [
  {
    key: 'publicidad',
    label: 'Publicidad',
    description:
      'Conectá Meta Ads y Google Analytics para medir de dónde salen los leads y cuánto cuesta cada uno.',
    plan: 'pro',
  },
  {
    key: 'emails',
    label: 'Emails',
    description:
      'Campañas de email a tu base de contactos, con segmentación, métricas de apertura y lista de bajas.',
    plan: 'pro',
  },
  {
    key: 'landings',
    label: 'Landings',
    description:
      'Páginas de captación con dominio propio, armadas por bloques y con analítica de conversión.',
    plan: 'pro',
  },
  {
    key: 'automatizaciones',
    label: 'Automatizaciones',
    description:
      'Cuando pasa algo en el CRM, la plataforma actúa sola: emails al cliente, avisos al agente y tareas en el calendario.',
    plan: 'pro',
  },
]

const MODULES_BY_KEY = new Map(MODULE_DEFINITIONS.map((m) => [m.key, m]))

export function getModuleDefinition(key: string): ModuleDefinition | null {
  return MODULES_BY_KEY.get(key as OrgModule) ?? null
}

export function isOrgModule(key: string): key is OrgModule {
  return (ORG_MODULES as readonly string[]).includes(key)
}

export function isOrgPlan(value: string): value is OrgPlan {
  return (ORG_PLANS as readonly string[]).includes(value)
}

/**
 * Lee la columna `modules`, que es un array JSON. Cualquier cosa rara —null,
 * JSON roto, claves que ya no existen— se descarta en silencio: una fila mal
 * formada no puede tumbar el menú de nadie.
 */
export function parseModules(raw: unknown): OrgModule[] {
  if (Array.isArray(raw)) return raw.filter((k): k is OrgModule => typeof k === 'string' && isOrgModule(k))
  if (typeof raw !== 'string' || raw.trim().length === 0) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed)
      ? parsed.filter((k): k is OrgModule => typeof k === 'string' && isOrgModule(k))
      : []
  } catch {
    return []
  }
}

export function parsePlan(raw: unknown): OrgPlan {
  return typeof raw === 'string' && isOrgPlan(raw) ? raw : 'basic'
}

/**
 * Un módulo está prendido sólo si la org tiene el plan que lo incluye Y se lo
 * activaron explícitamente. El plan solo no alcanza: eso es lo que hace que la
 * activación sea manual.
 */
export function isModuleEnabled(plan: OrgPlan, modules: readonly OrgModule[], key: string): boolean {
  const def = getModuleDefinition(key)
  if (!def) return false
  if (def.plan === 'pro' && plan !== 'pro') return false
  return modules.includes(def.key)
}

/** Los módulos efectivamente disponibles para la org. */
export function enabledModules(plan: OrgPlan, modules: readonly OrgModule[]): OrgModule[] {
  return ORG_MODULES.filter((key) => isModuleEnabled(plan, modules, key))
}
