import type { CSSProperties } from 'react'
import { apiFetch } from './api'

export interface OperationType {
  id: number
  slug: string
  label: string
}

export interface CommercialStage {
  id: number
  operation_type_id: number
  slug: string
  label: string
  sort_order: number
  is_terminal: boolean
  color: string
}

export interface PropertyStatus {
  id: number
  operation_type_id: number | null
  slug: string
  label: string
  color: string
}

export interface PropertyConfig {
  operation_types: OperationType[]
  commercial_stages: CommercialStage[]
  property_statuses: PropertyStatus[]
}

// El color de etapas/estados viene de la config dinámica por org como HEX
// (dato de negocio por org, no un token Tailwind) — se aplica con estilo
// inline, nunca con una clase. `stagePillStyle` imita el par -100/-800 (bg
// tenue + texto sólido); `stageDotStyle` es el color plano del punto.
export function stagePillStyle(hex?: string): CSSProperties {
  const c = hex || '#9ca3af'
  return { backgroundColor: `${c}1a`, color: c }
}
export function stageDotStyle(hex?: string): CSSProperties {
  return { backgroundColor: hex || '#9ca3af' }
}

let _cache: PropertyConfig | null = null

export async function fetchPropertyConfig(): Promise<PropertyConfig> {
  if (_cache) return _cache
  const res = await apiFetch('properties', '/property-config')
  _cache = (await res.json()) as PropertyConfig
  return _cache!
}

export function stagesForType(config: PropertyConfig, operationTypeId: number): CommercialStage[] {
  return config.commercial_stages
    .filter(s => s.operation_type_id === operationTypeId)
    .sort((a, b) => a.sort_order - b.sort_order)
}

export function statusesForType(config: PropertyConfig, operationTypeId?: number): PropertyStatus[] {
  return config.property_statuses.filter(
    s => s.operation_type_id === null || s.operation_type_id === operationTypeId
  )
}

export function getStage(config: PropertyConfig, id: number | null): CommercialStage | undefined {
  if (!id) return undefined
  return config.commercial_stages.find(s => s.id === id)
}

export function getStatus(config: PropertyConfig, id: number | null): PropertyStatus | undefined {
  if (!id) return undefined
  return config.property_statuses.find(s => s.id === id)
}

export function getOpType(config: PropertyConfig, id: number | null): OperationType | undefined {
  if (!id) return undefined
  return config.operation_types.find(t => t.id === id)
}
