// ============================================================
// Defaults de bloques estáticos (binding_mode = 'org-static').
//
// La inmobiliaria configura una sola vez el contenido fijo
// (portada, metodología, servicios, etc.) en
// Configuración → Tasaciones → Bloques estáticos. Después esos
// valores se pueden aplicar manualmente a cada template desde
// el editor (botón "Aplicar valores guardados").
//
// Storage: reutilizamos el endpoint /org-variables (admin API).
//   - namespace: 'custom'
//   - key:       'custom.block_defaults.<tipo>'
//   - value:     JSON.stringify(data)
//
// Esto evita migración de backend.
// ============================================================

import type { AppraisalBlockType } from '../renderer/types'
import { listVariables, createVariable, updateVariable } from './api'

/**
 * Bloques cuyo contenido tiene sentido configurar una sola vez
 * a nivel inmobiliaria. Los bloques que dependen de la tasación
 * (property_data, swot, comparables_list, price_projection) o
 * del asesor (agent_contact_card, cta_whatsapp) quedan fuera.
 */
export const STATIC_BLOCK_TYPES: AppraisalBlockType[] = [
  'cover',
  'proposal_commercial',
  'services_grid',
  'market_stats',
  'funnel_chart',
  'methodology',
  'notary_charts',
]

const KEY_PREFIX = 'custom.block_defaults.'

function keyFor(type: AppraisalBlockType): string {
  return `${KEY_PREFIX}${type}`
}

function isStaticBlockDefaultKey(key: string | null | undefined): boolean {
  return typeof key === 'string' && key.startsWith(KEY_PREFIX)
}

export interface StaticBlockDefaultEntry {
  /** id de la org-variable subyacente (para updates). */
  id: string
  /** data del bloque (lo que normalmente vive en TemplateBlock.data). */
  data: Record<string, unknown>
}

export type StaticBlockDefaultsMap = Partial<Record<AppraisalBlockType, StaticBlockDefaultEntry>>

/** Carga todos los defaults de bloques estáticos, indexados por tipo. */
export async function loadStaticBlockDefaults(): Promise<StaticBlockDefaultsMap> {
  const all = await listVariables({ namespace: 'custom' })
  const out: StaticBlockDefaultsMap = {}
  for (const v of all as any[]) {
    if (!isStaticBlockDefaultKey(v?.key)) continue
    const type = (v.key as string).slice(KEY_PREFIX.length) as AppraisalBlockType
    let data: Record<string, unknown> = {}
    try { data = v.value ? JSON.parse(v.value) : {} } catch { data = {} }
    out[type] = { id: v.id, data }
  }
  return out
}

/** Crea o actualiza el default para un tipo de bloque. */
export async function saveStaticBlockDefault(
  type: AppraisalBlockType,
  data: Record<string, unknown>,
  existingId?: string,
): Promise<{ id: string }> {
  const value = JSON.stringify(data ?? {})
  if (existingId) {
    await updateVariable(existingId, { value })
    return { id: existingId }
  }
  const { id } = await createVariable({
    key: keyFor(type),
    label: `Bloque estático: ${type}`,
    value,
    value_type: 'text',
    namespace: 'custom',
  })
  return { id }
}
