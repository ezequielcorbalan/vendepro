'use client'

import { useState } from 'react'
import { Variable } from 'lucide-react'
import type { ConfigField, AutomationsMeta } from '@/lib/automations'
import { stageLabel } from '@/lib/automations'
import { Input, Textarea, Select, Field } from '@/components/ui/Input'
import { Switch } from '@/components/ui/Switch'
import { Button } from '@/components/ui/Button'
import { Text } from '@/components/ui/Typography'

/**
 * Renderiza los campos que declara el catálogo del backend (`config_fields`).
 *
 * Es el motor del editor: agregar un campo a una acción en el catálogo lo hace
 * aparecer acá sin tocar el frontend. Por eso no hay ningún formulario
 * hardcodeado por tipo de acción.
 */

export interface FieldContext {
  meta: AutomationsMeta
  /** Etapas que corresponden a la entidad del disparador elegido. */
  stages: string[]
  /** Usuarios de la org, para los campos de tipo 'user'. */
  users: Array<{ id: string; full_name: string }>
  /** Variables disponibles para el disparador elegido. */
  variables: string[]
}

interface ConfigFieldsProps {
  fields: ConfigField[]
  values: Record<string, unknown>
  onChange: (name: string, value: unknown) => void
  ctx: FieldContext
  errors?: Record<string, string>
}

export function ConfigFields({ fields, values, onChange, ctx, errors = {} }: ConfigFieldsProps) {
  return (
    <div className="space-y-4">
      {fields.map(field => (
        <ConfigFieldInput
          key={field.name}
          field={field}
          value={values[field.name]}
          onChange={v => onChange(field.name, v)}
          ctx={ctx}
          error={errors[field.name]}
        />
      ))}
    </div>
  )
}

function ConfigFieldInput({
  field, value, onChange, ctx, error,
}: {
  field: ConfigField
  value: unknown
  onChange: (value: unknown) => void
  ctx: FieldContext
  error?: string
}) {
  const str = value === null || value === undefined ? '' : String(value)

  // El switch va sin `Field`: ya trae su propio label a la derecha.
  if (field.type === 'boolean') {
    const checked = value === undefined || value === null
      ? field.default !== false
      : value === true || value === 'true' || value === 1
    return (
      <div>
        <Switch checked={checked} onChange={onChange} label={field.label} />
        {field.help && <Text size="xs" tone="muted" className="mt-1">{field.help}</Text>}
      </div>
    )
  }

  return (
    <Field label={field.label} required={field.required} hint={field.help} error={error}>
      {field.type === 'html' || field.type === 'textarea' ? (
        <TextWithVariables
          value={str}
          onChange={onChange}
          placeholder={field.placeholder}
          variables={ctx.variables}
        />
      ) : field.type === 'number' ? (
        <Input
          type="number"
          min={0}
          value={str}
          placeholder={field.placeholder}
          onChange={e => onChange(e.target.value === '' ? '' : Number(e.target.value))}
        />
      ) : field.type === 'select' ? (
        <Select value={str} onChange={e => onChange(e.target.value)}>
          <option value="">Elegí una opción</option>
          {(field.options ?? []).map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </Select>
      ) : field.type === 'stage' ? (
        <Select value={str} onChange={e => onChange(e.target.value)}>
          <option value="">Cualquier etapa</option>
          {ctx.stages.map(stage => (
            <option key={stage} value={stage}>{stageLabel(stage)}</option>
          ))}
        </Select>
      ) : field.type === 'user' ? (
        <Select value={str} onChange={e => onChange(e.target.value)}>
          <option value="">Elegí un usuario</option>
          {ctx.users.map(user => (
            <option key={user.id} value={user.id}>{user.full_name}</option>
          ))}
        </Select>
      ) : field.type === 'multiselect' ? (
        <Input
          value={Array.isArray(value) ? value.join(', ') : str}
          placeholder={field.placeholder ?? 'Separá con comas'}
          onChange={e => onChange(
            e.target.value.split(',').map(s => s.trim()).filter(Boolean),
          )}
        />
      ) : (
        <TextWithVariables
          singleLine
          value={str}
          onChange={onChange}
          placeholder={field.placeholder}
          variables={ctx.variables}
        />
      )}
    </Field>
  )
}

/**
 * Campo de texto con inserción de variables.
 *
 * Sin esto el cliente tendría que saber de memoria que existe
 * `{{lead.first_name}}` y escribirlo sin errores de tipeo — que es
 * exactamente el error que después manda un mail diciendo "Hola ,".
 */
function TextWithVariables({
  value, onChange, placeholder, variables, singleLine = false,
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  variables: string[]
  singleLine?: boolean
}) {
  const [open, setOpen] = useState(false)
  const Control = singleLine ? Input : Textarea

  const insert = (variable: string) => {
    onChange(`${value}{{${variable}}}`)
    setOpen(false)
  }

  return (
    <div className="space-y-1.5">
      <Control
        value={value}
        placeholder={placeholder}
        onChange={(e: { target: { value: string } }) => onChange(e.target.value)}
      />
      <div>
        <Button
          variant="ghost"
          size="sm"
          icon={<Variable className="w-4 h-4" />}
          aria-expanded={open}
          onClick={() => setOpen(o => !o)}
        >
          {open ? 'Ocultar variables' : 'Insertar variable'}
        </Button>

        {open && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {variables.length === 0 ? (
              <Text size="xs" tone="muted">Elegí primero un disparador para ver sus variables.</Text>
            ) : variables.map(variable => (
              <Button variant="ghost" size="sm"
                key={variable}
                type="button"
                onClick={() => insert(variable)}
                className="text-xs px-2.5 py-1 rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200 font-mono"
              >
                {`{{${variable}}}`}
              </Button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
