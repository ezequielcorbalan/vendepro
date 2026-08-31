'use client'

import { Plus, Trash2, ArrowUp, ArrowDown, Clock } from 'lucide-react'
import type { ActionMeta } from '@/lib/automations'
import { delayLabel, fromMinutes, toMinutes, NEUTRAL_CHIP } from '@/lib/automations'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input, Select, Field } from '@/components/ui/Input'
import { Alert } from '@/components/ui/Alert'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Heading, Text } from '@/components/ui/Typography'
import { ConfigFields, type FieldContext } from './ConfigFields'

/** Una acción tal como la maneja el editor (todavía sin id del backend). */
export interface DraftAction {
  /** Clave local estable, para que React no pierda el foco al reordenar. */
  key: string
  id?: string
  action_type: string
  action_config: Record<string, unknown>
  delay_minutes: number
}

interface ActionsEditorProps {
  actions: DraftAction[]
  onChange: (actions: DraftAction[]) => void
  /** Acciones válidas para la entidad del disparador elegido. */
  available: ActionMeta[]
  ctx: FieldContext
}

/**
 * Las acciones se muestran como una secuencia en el tiempo, no como una lista
 * plana: lo que el cliente necesita entender de un vistazo es *cuándo* sale
 * cada cosa, que es lo que más se malinterpreta de una automatización.
 */
export function ActionsEditor({ actions, onChange, available, ctx }: ActionsEditorProps) {
  const update = (index: number, patch: Partial<DraftAction>) => {
    onChange(actions.map((a, i) => (i === index ? { ...a, ...patch } : a)))
  }

  const changeType = (index: number, actionType: string) => {
    const def = available.find(a => a.key === actionType)
    // Al cambiar de tipo, la config vieja no aplica: se arranca con los
    // defaults declarados en el catálogo.
    const defaults: Record<string, unknown> = {}
    for (const field of def?.config_fields ?? []) {
      if (field.default !== undefined) defaults[field.name] = field.default
    }
    update(index, { action_type: actionType, action_config: defaults })
  }

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= actions.length) return
    const next = [...actions]
    ;[next[index], next[target]] = [next[target], next[index]]
    onChange(next)
  }

  const add = () => {
    const first = available.find(a => a.implemented) ?? available[0]
    if (!first) return
    const defaults: Record<string, unknown> = {}
    for (const field of first.config_fields) {
      if (field.default !== undefined) defaults[field.name] = field.default
    }
    onChange([...actions, {
      key: `draft-${Date.now()}-${actions.length}`,
      action_type: first.key,
      action_config: defaults,
      delay_minutes: 0,
    }])
  }

  return (
    <div className="space-y-3">
      {actions.length === 0 && (
        <Alert tone="warning">
          Una automatización necesita al menos una acción. Agregá la primera para poder guardarla.
        </Alert>
      )}

      {actions.map((action, index) => {
        const def = available.find(a => a.key === action.action_type)
        const delay = fromMinutes(action.delay_minutes)

        return (
          <Card key={action.key}>
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  aria-hidden
                  className="w-6 h-6 rounded-full bg-primary/10 text-primary grid place-items-center text-xs font-semibold shrink-0"
                >
                  {index + 1}
                </span>
                <Heading level={4}>{def?.label ?? action.action_type}</Heading>
                <StatusBadge
                  label={delayLabel(action.delay_minutes)}
                  color={NEUTRAL_CHIP}
                />
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <Button
                  variant="ghost" size="icon"
                  aria-label={`Subir la acción ${index + 1}`}
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                >
                  <ArrowUp className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost" size="icon"
                  aria-label={`Bajar la acción ${index + 1}`}
                  disabled={index === actions.length - 1}
                  onClick={() => move(index, 1)}
                >
                  <ArrowDown className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost" size="icon"
                  aria-label={`Quitar la acción ${index + 1}`}
                  onClick={() => onChange(actions.filter((_, i) => i !== index))}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Qué hacer" required>
                <Select
                  value={action.action_type}
                  onChange={e => changeType(index, e.target.value)}
                >
                  {available.map(option => (
                    <option key={option.key} value={option.key}>
                      {option.label}{option.implemented ? '' : ' (próximamente)'}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field
                label="Cuándo"
                hint="Contado desde que se dispara la automatización, no desde la acción anterior."
              >
                <div className="flex gap-2">
                  <Input
                    type="number"
                    min={0}
                    aria-label="Cantidad de espera"
                    value={delay.value === 0 ? '' : delay.value}
                    placeholder="0"
                    onChange={e => update(index, {
                      delay_minutes: toMinutes(Number(e.target.value), delay.unit),
                    })}
                    className="flex-1"
                  />
                  <Select
                    aria-label="Unidad de espera"
                    value={delay.unit}
                    onChange={e => update(index, {
                      delay_minutes: toMinutes(delay.value, e.target.value as 'min' | 'h' | 'd'),
                    })}
                    className="w-32"
                  >
                    <option value="min">minutos</option>
                    <option value="h">horas</option>
                    <option value="d">días</option>
                  </Select>
                </div>
              </Field>
            </div>

            {def?.description && (
              <Text size="xs" tone="muted" className="mt-2">{def.description}</Text>
            )}

            {def && !def.implemented && (
              <Alert tone="warning" className="mt-3">
                Esta acción todavía no está disponible. Se va a registrar como omitida hasta que lo esté.
              </Alert>
            )}

            {def && def.config_fields.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <ConfigFields
                  fields={def.config_fields}
                  values={action.action_config}
                  onChange={(name, value) => update(index, {
                    action_config: { ...action.action_config, [name]: value },
                  })}
                  ctx={ctx}
                />
              </div>
            )}
          </Card>
        )
      })}

      <Button
        variant="outline"
        icon={<Plus className="w-4 h-4" />}
        onClick={add}
        disabled={available.length === 0}
      >
        Agregar acción
      </Button>

      {actions.length > 1 && (
        <Text size="xs" tone="muted" className="flex items-center gap-1.5">
          <Clock className="w-4 h-4 text-gray-600" aria-hidden />
          Las esperas se cuentan todas desde el disparo, así que dos acciones con la misma espera salen juntas.
        </Text>
      )}
    </div>
  )
}
