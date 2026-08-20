'use client'

import { UserCheck } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Heading, Text } from '@/components/ui/Typography'
import { formatDate } from '@/lib/utils'
import {
  QUESTIONS,
  attr,
  labelOf,
  OPERATION_OPTIONS,
  type PropertyType,
} from '@/lib/ficha-publica'

/** Campos que el propietario declara y el agente no debería pisar sin querer. */
export interface OwnerDeclaredFicha {
  filled_by?: string | null
  submitted_at?: string | null
  owner_name?: string | null
  owner_phone?: string | null
  owner_email?: string | null
  property_type?: string | null
  operation?: string | null
  covered_area?: number | null
  semi_area?: number | null
  uncovered_area?: number | null
  land_area?: number | null
  [key: string]: unknown
}

/** Preguntas cuya respuesta se muestra tal cual (las superficies van aparte). */
const AREA_KEYS = new Set(['covered_area', 'semi_area', 'uncovered_area', 'land_area'])
const SKIP = new Set(['address', 'neighborhood', 'property_type', 'operation'])

/**
 * Lo que declaró el propietario en /f/<slug>.
 *
 * Va aparte del formulario del agente y en modo lectura a propósito: es
 * testimonio de lo que dijo el dueño, no una medición. El agente corrige sus
 * propios campos sin pisar esta declaración.
 *
 * Las filas salen del mismo catálogo que armó el formulario, así que sólo
 * aparecen las preguntas que de verdad se le hicieron a este tipo de propiedad.
 */
export function DeclaredByOwnerCard({ ficha }: { ficha: OwnerDeclaredFicha }) {
  if (ficha.filled_by !== 'propietario') return null

  const type = (ficha.property_type as PropertyType) || 'departamento'

  const rows = QUESTIONS.filter(q => q.appliesTo.includes(type))
    .filter(q => !AREA_KEYS.has(q.key) && !SKIP.has(q.key))
    .map(q => {
      const raw = ficha[q.key]
      if (raw === null || raw === undefined || raw === '') return null
      const options = attr(q.options, type)
      // Los multivalor se guardan coma-separados: se traduce cada parte.
      const value =
        q.kind === 'multipills' && typeof raw === 'string'
          ? String(raw)
              .split(',')
              .map(part => (options ? labelOf(options, part.trim()) : part.trim()))
              .filter(Boolean)
              .join(', ')
          : options
            ? labelOf(options, raw as string)
            : String(raw)
      if (!value) return null
      return { label: attr(q.label, type) ?? q.key, value }
    })
    .filter((r): r is { label: string; value: string } => r !== null)

  const areas = [
    ['Cubierta', ficha.covered_area],
    ['Semicubierta', ficha.semi_area],
    ['Descubierta', ficha.uncovered_area],
    ['Terreno', ficha.land_area],
  ].filter(([, v]) => typeof v === 'number' && v > 0) as [string, number][]

  const builtTotal = ['covered_area', 'semi_area', 'uncovered_area']
    .map(k => ficha[k])
    .filter((v): v is number => typeof v === 'number')
    .reduce((a, b) => a + b, 0)

  const contact = [ficha.owner_phone, ficha.owner_email].filter(Boolean).join(' · ')
  const operationLabel = labelOf(OPERATION_OPTIONS, ficha.operation)

  return (
    <Card className="border-primary/20 bg-primary/[0.03]">
      <div className="flex items-center gap-2 mb-1">
        <UserCheck className="w-4 h-4 text-primary" />
        <Heading level={4}>Declarado por el propietario</Heading>
      </div>
      <Text size="xs" tone="muted">
        {ficha.owner_name ?? 'El propietario'} completó esta ficha
        {ficha.submitted_at ? ` el ${formatDate(ficha.submitted_at)}` : ''}
        {operationLabel ? ` para ${operationLabel.toLowerCase()}` : ''}.
        Son datos declarados, no verificados en la visita.
      </Text>
      {contact && <Text size="xs" tone="muted" className="mt-0.5">{contact}</Text>}

      {areas.length > 0 && (
        <div className="mt-3 p-3 rounded-control bg-white/70 border border-primary/10">
          <Text size="xs" tone="muted" className="mb-1">Superficies declaradas</Text>
          <div className="flex flex-wrap gap-x-5 gap-y-1">
            {areas.map(([label, v]) => (
              <Text key={label} size="sm">
                <span className="text-gray-500">{label}:</span>{' '}
                <strong>{v} m²</strong>
              </Text>
            ))}
            {builtTotal > 0 && (
              <Text size="sm">
                <span className="text-gray-500">Total:</span> <strong>{builtTotal} m²</strong>
              </Text>
            )}
          </div>
        </div>
      )}

      {rows.length > 0 && (
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2">
          {rows.map(({ label, value }) => (
            <div key={label}>
              <dt className="text-xs text-gray-500">{label}</dt>
              <dd className="text-sm font-medium text-ink">{value}</dd>
            </div>
          ))}
        </dl>
      )}
    </Card>
  )
}
