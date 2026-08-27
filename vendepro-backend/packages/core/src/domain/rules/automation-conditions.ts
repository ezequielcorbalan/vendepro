import { ValidationError } from '../errors/validation-error'
import {
  UNARY_OPERATORS,
  isConditionOperator,
  type ConditionOperator,
} from '../value-objects/automation-catalog'

/**
 * Evaluación de las condiciones de una automatización.
 *
 * Todas las condiciones de una automatización se combinan con AND: si una
 * falla, el run se marca `skipped` con `skip_reason = 'conditions_not_met'`.
 * No hay OR ni anidamiento a propósito — en la práctica se resuelve con dos
 * automatizaciones, y evita un constructor de reglas ilegible.
 */

export interface AutomationCondition {
  /** Path con puntos dentro del contexto: 'lead.source', 'property.price'. */
  field: string
  op: ConditionOperator
  /** Ausente en los operadores unarios (is_empty / is_not_empty). */
  value?: unknown
}

export type AutomationContext = Record<string, unknown>

/** Lee `lead.source` de `{ lead: { source: 'web' } }`. Devuelve undefined si el path no existe. */
export function readPath(context: AutomationContext, path: string): unknown {
  const parts = path.split('.')
  let current: unknown = context
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') return undefined
    current = (current as Record<string, unknown>)[part]
  }
  return current
}

export function parseConditions(raw: unknown): AutomationCondition[] {
  if (raw === null || raw === undefined) return []
  const list = typeof raw === 'string' ? safeJsonArray(raw) : raw
  if (!Array.isArray(list)) {
    throw new ValidationError('Las condiciones deben ser una lista', { conditions: 'Inválido' })
  }
  return list.map((item, i) => {
    const c = item as Record<string, unknown>
    const field = typeof c?.field === 'string' ? c.field.trim() : ''
    if (!field) {
      throw new ValidationError(`Condición ${i + 1}: falta el campo`, { conditions: 'Inválido' })
    }
    const op = String(c?.op ?? '')
    if (!isConditionOperator(op)) {
      throw new ValidationError(`Condición ${i + 1}: operador desconocido "${op}"`, { conditions: 'Inválido' })
    }
    const unary = UNARY_OPERATORS.includes(op)
    if (!unary && c?.value === undefined) {
      throw new ValidationError(`Condición ${i + 1}: falta el valor a comparar`, { conditions: 'Inválido' })
    }
    return unary ? { field, op } : { field, op, value: c.value }
  })
}

function safeJsonArray(raw: string): unknown {
  const trimmed = raw.trim()
  if (trimmed.length === 0) return []
  try {
    return JSON.parse(trimmed)
  } catch {
    throw new ValidationError('Las condiciones no son JSON válido', { conditions: 'Inválido' })
  }
}

/** true si TODAS las condiciones se cumplen (lista vacía → true). */
export function evaluateConditions(
  conditions: readonly AutomationCondition[],
  context: AutomationContext,
): boolean {
  return conditions.every((c) => evaluateCondition(c, context))
}

/** Primera condición que no se cumple, para poder explicarlo en el log. */
export function firstFailingCondition(
  conditions: readonly AutomationCondition[],
  context: AutomationContext,
): AutomationCondition | null {
  return conditions.find((c) => !evaluateCondition(c, context)) ?? null
}

export function evaluateCondition(condition: AutomationCondition, context: AutomationContext): boolean {
  const actual = readPath(context, condition.field)

  switch (condition.op) {
    case 'is_empty':
      return isEmpty(actual)
    case 'is_not_empty':
      return !isEmpty(actual)
    case 'eq':
      return looseEquals(actual, condition.value)
    case 'neq':
      return !looseEquals(actual, condition.value)
    case 'contains':
      return textOf(actual).includes(textOf(condition.value))
    case 'not_contains':
      return !textOf(actual).includes(textOf(condition.value))
    case 'gt':
    case 'gte':
    case 'lt':
    case 'lte':
      return compareNumeric(condition.op, actual, condition.value)
    case 'in':
      return toList(condition.value).some((v) => looseEquals(actual, v))
    case 'not_in':
      return !toList(condition.value).some((v) => looseEquals(actual, v))
  }
}

function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true
  if (typeof value === 'string') return value.trim().length === 0
  if (Array.isArray(value)) return value.length === 0
  return false
}

/**
 * Comparación tolerante: los valores llegan del JSON de la config (siempre
 * string en el editor) y del contexto (tipados). `"100" == 100` debe ser true,
 * y los strings se comparan sin distinguir mayúsculas ni espacios sobrantes.
 */
function looseEquals(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (isEmpty(a) && isEmpty(b)) return true
  if (isEmpty(a) || isEmpty(b)) return false
  if (typeof a === 'boolean' || typeof b === 'boolean') return toBool(a) === toBool(b)
  const na = toNumber(a)
  const nb = toNumber(b)
  if (na !== null && nb !== null) return na === nb
  return textOf(a) === textOf(b)
}

function compareNumeric(op: 'gt' | 'gte' | 'lt' | 'lte', a: unknown, b: unknown): boolean {
  const na = toNumber(a)
  const nb = toNumber(b)
  // Sin dos números comparables la condición no se cumple — nunca lanza:
  // un dato faltante no debe romper la ejecución de la automatización.
  if (na === null || nb === null) return false
  switch (op) {
    case 'gt': return na > nb
    case 'gte': return na >= nb
    case 'lt': return na < nb
    case 'lte': return na <= nb
  }
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (trimmed.length === 0) return null
    const n = Number(trimmed)
    return Number.isFinite(n) ? n : null
  }
  return null
}

function toBool(value: unknown): boolean {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value !== 0
  const t = textOf(value)
  return t === 'true' || t === '1' || t === 'si' || t === 'sí'
}

function textOf(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (Array.isArray(value)) return value.map(textOf).join(',')
  return String(value).trim().toLowerCase()
}

/** Acepta `["a","b"]`, `"a,b"` o `"[\"a\",\"b\"]"` — el editor manda cualquiera de las tres. */
function toList(value: unknown): unknown[] {
  if (Array.isArray(value)) return value
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed)
        if (Array.isArray(parsed)) return parsed
      } catch {
        // cae al split por coma
      }
    }
    return trimmed.split(',').map((s) => s.trim()).filter((s) => s.length > 0)
  }
  return value === null || value === undefined ? [] : [value]
}
