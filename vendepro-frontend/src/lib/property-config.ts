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

// Tailwind class map por color slug
export const COLOR_CLASS: Record<string, string> = {
  green:   'bg-green-100 text-green-700',
  amber:   'bg-amber-100 text-amber-700',
  blue:    'bg-blue-100 text-blue-700',
  purple:  'bg-purple-100 text-purple-700',
  emerald: 'bg-emerald-100 text-emerald-700',
  cyan:    'bg-cyan-100 text-cyan-700',
  orange:  'bg-orange-100 text-orange-700',
  red:     'bg-red-100 text-red-700',
  gray:    'bg-gray-100 text-gray-500',
  pink:    'bg-pink-100 text-pink-700',
  yellow:  'bg-yellow-100 text-yellow-700',
}

// Dot color map for stage indicators
export const DOT_CLASS: Record<string, string> = {
  green:   'bg-green-500',
  amber:   'bg-amber-500',
  blue:    'bg-blue-500',
  purple:  'bg-purple-500',
  emerald: 'bg-emerald-500',
  cyan:    'bg-cyan-500',
  orange:  'bg-orange-500',
  red:     'bg-red-500',
  gray:    'bg-gray-400',
  pink:    'bg-pink-500',
  yellow:  'bg-yellow-400',
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
