'use client'

import { Plus, Trash2 } from 'lucide-react'
import type { AutomationCondition, AutomationsMeta } from '@/lib/automations'
import { Input, Select } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Text } from '@/components/ui/Typography'

/**
 * Condiciones de la automatización. Todas se combinan con Y: si una no se
 * cumple, la automatización no corre. No hay O ni anidamiento a propósito —
 * en la práctica se resuelve con dos automatizaciones y evita un constructor
 * de reglas que nadie entiende.
 */

interface ConditionsEditorProps {
  conditions: AutomationCondition[]
  onChange: (conditions: AutomationCondition[]) => void
  meta: AutomationsMeta
  /** Variables del disparador elegido — son los campos comparables. */
  variables: string[]
}

export function ConditionsEditor({ conditions, onChange, meta, variables }: ConditionsEditorProps) {
  const unaryOps = new Set(meta.operators.filter(o => o.unary).map(o => o.value))

  const update = (index: number, patch: Partial<AutomationCondition>) => {
    onChange(conditions.map((c, i) => {
      if (i !== index) return c
      const next = { ...c, ...patch }
      // Al pasar a un operador sin valor (está vacío / no está vacío), el
      // valor anterior deja de tener sentido y se descarta.
      if (patch.op && unaryOps.has(patch.op)) delete next.value
      return next
    }))
  }

  const add = () => {
    onChange([...conditions, { field: variables[0] ?? '', op: 'eq', value: '' }])
  }

  const remove = (index: number) => {
    onChange(conditions.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-3">
      {conditions.length === 0 ? (
        <Text size="sm" tone="muted">
          Sin condiciones, la automatización corre siempre que se dispare el evento.
        </Text>
      ) : (
        <div className="space-y-2">
          {conditions.map((condition, index) => (
            <div key={index} className="space-y-2">
              {index > 0 && (
                <Text size="xs" tone="muted" weight="medium" className="uppercase tracking-wide">
                  Y además
                </Text>
              )}
              <div className="flex flex-wrap items-start gap-2">
                <Select
                  aria-label="Campo"
                  value={condition.field}
                  onChange={e => update(index, { field: e.target.value })}
                  className="flex-1 min-w-[180px]"
                >
                  <option value="">Elegí un campo</option>
                  {variables.map(variable => (
                    <option key={variable} value={variable}>{variable}</option>
                  ))}
                </Select>

                <Select
                  aria-label="Comparación"
                  value={condition.op}
                  onChange={e => update(index, { op: e.target.value })}
                  className="flex-1 min-w-[160px]"
                >
                  {meta.operators.map(op => (
                    <option key={op.value} value={op.value}>{op.label}</option>
                  ))}
                </Select>

                {!unaryOps.has(condition.op) && (
                  <Input
                    aria-label="Valor"
                    value={condition.value === undefined || condition.value === null ? '' : String(condition.value)}
                    placeholder="Valor"
                    onChange={e => update(index, { value: e.target.value })}
                    className="flex-1 min-w-[140px]"
                  />
                )}

                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Quitar condición ${index + 1}`}
                  onClick={() => remove(index)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Button variant="outline" icon={<Plus className="w-4 h-4" />} onClick={add}>
        Agregar condición
      </Button>
    </div>
  )
}
