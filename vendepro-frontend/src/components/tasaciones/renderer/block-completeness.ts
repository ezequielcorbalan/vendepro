// ============================================================
// Completitud de bloques de tasación.
//
// Decide si un bloque tiene datos suficientes para publicarse.
// Solo los bloques que dependen de los datos de la tasación
// (binding_mode 'tasacion') pueden quedar "incompletos": el asesor
// no cargó los m², el FODA, los precios o los comparables.
//
// Los bloques estáticos / de organización (propuesta, servicios,
// metodología, etc.) traen su contenido del template y se consideran
// siempre completos.
//
// Uso:
//   - TemplateRenderer en modo edición: muestra el bloque incompleto
//     con un recuadro de aviso ("no se va a publicar").
//   - TemplateRenderer publicado (landing / PDF): excluye el bloque.
// ============================================================

import type { AppraisalContext, TemplateBlock } from './types'

export interface BlockCompleteness {
  complete: boolean
  /** Qué falta completar, para el aviso. null cuando está completo. */
  missingLabel: string | null
}

function hasText(v: unknown): boolean {
  return typeof v === 'string' && v.trim().length > 0
}

function hasPositiveNum(v: unknown): boolean {
  return typeof v === 'number' && Number.isFinite(v) && v > 0
}

export function getBlockCompleteness(
  block: Pick<TemplateBlock, 'type' | 'data'>,
  appraisal: AppraisalContext,
): BlockCompleteness {
  const ok: BlockCompleteness = { complete: true, missingLabel: null }
  const missing = (label: string): BlockCompleteness => ({ complete: false, missingLabel: label })

  switch (block.type) {
    case 'property_data':
      return hasPositiveNum(appraisal.covered_area) || hasPositiveNum(appraisal.total_area)
        ? ok
        : missing('los metros cuadrados de la propiedad')

    case 'swot': {
      const s = appraisal.swot
      const anyFilled = !!s && (hasText(s.strengths) || hasText(s.weaknesses) || hasText(s.opportunities) || hasText(s.threats))
      return anyFilled ? ok : missing('el análisis FODA')
    }

    case 'price_projection': {
      const p = appraisal.prices
      const anyPrice = !!p && (hasPositiveNum(p.suggested) || hasPositiveNum(p.test) || hasPositiveNum(p.expected_close))
      return anyPrice ? ok : missing('los precios de la tasación')
    }

    case 'comparables_list': {
      const variant = (block.data as { variant?: string } | undefined)?.variant
      const kind = variant === 'reserved' ? 'venta' : 'publicacion'
      const count = (appraisal.comparables ?? []).filter(c => (c.kind ?? 'publicacion') === kind).length
      return count > 0 ? ok : missing(kind === 'venta' ? 'al menos una propiedad vendida en la zona' : 'al menos una propiedad comparable')
    }

    default:
      // cover, work_conditions y bloques estáticos / de organización
      // siempre se consideran completos.
      return ok
  }
}
