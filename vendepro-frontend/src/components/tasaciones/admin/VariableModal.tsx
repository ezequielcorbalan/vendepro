'use client'
import { useState } from 'react'
import { createVariable } from '../shared/api'

interface Props {
  namespace: 'market' | 'notary' | 'custom'
  onClose: () => void
  onCreated: () => void
}

const VALUE_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: 'number',    label: 'Número' },
  { value: 'percent',   label: 'Porcentaje' },
  { value: 'text',      label: 'Texto' },
  { value: 'date',      label: 'Fecha' },
  { value: 'image_url', label: 'Imagen (URL)' },
]

const NAMESPACE_LABEL: Record<Props['namespace'], string> = {
  market: 'Estadística de mercado',
  notary: 'Dato de escribanía',
  custom: 'Variable personalizada',
}

export function VariableModal({ namespace, onClose, onCreated }: Props) {
  const [keySuffix, setKeySuffix] = useState('')
  const [label, setLabel] = useState('')
  const [valueType, setValueType] = useState<string>('text')
  const [value, setValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const keyValid = /^[a-z_][a-z0-9_]*$/.test(keySuffix)

  const save = async () => {
    if (!keyValid || saving) return
    setSaving(true)
    setError('')
    try {
      await createVariable({
        key: `${namespace}.${keySuffix}`,
        label,
        value_type: valueType,
        value,
        namespace,
      })
      onCreated()
      onClose()
    } catch (e: any) {
      setError(e?.message ?? 'Error al crear variable')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-6">
        <h3 className="text-lg font-semibold">Nueva {NAMESPACE_LABEL[namespace].toLowerCase()}</h3>
        <p className="mt-1 text-xs text-slate-500">
          Las variables se referencian desde los bloques con el formato <span className="font-mono">{namespace}.nombre</span>.
        </p>

        <div className="mt-4 space-y-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">
              Identificador (key)
            </span>
            <div className="flex items-center rounded border border-slate-300 text-sm">
              <span className="bg-slate-100 px-2 py-2 font-mono text-slate-500">{namespace}.</span>
              <input
                value={keySuffix}
                onChange={e => setKeySuffix(e.target.value)}
                className="flex-1 px-2 py-2"
                placeholder="mi_variable"
              />
            </div>
            {!keyValid && keySuffix && (
              <span className="text-xs text-rose-500">Solo letras, números y guion bajo. Debe empezar con letra.</span>
            )}
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">
              Etiqueta visible
            </span>
            <input
              value={label}
              onChange={e => setLabel(e.target.value)}
              className="rounded border border-slate-300 px-3 py-2 text-sm"
              placeholder="Ej: Propiedades vendidas"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">
              Tipo de dato
            </span>
            <select
              value={valueType}
              onChange={e => setValueType(e.target.value)}
              className="rounded border border-slate-300 px-3 py-2 text-sm"
            >
              {VALUE_TYPE_OPTIONS.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">
              Valor inicial
            </span>
            <input
              value={value}
              onChange={e => setValue(e.target.value)}
              className="rounded border border-slate-300 px-3 py-2 text-sm"
              placeholder={valueType === 'image_url' ? 'https://...' : ''}
            />
          </label>
        </div>

        {error && <p className="mt-3 text-xs text-rose-500">{error}</p>}

        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="rounded px-4 py-2 text-sm text-slate-600 hover:bg-slate-100">
            Cancelar
          </button>
          <button
            onClick={save}
            disabled={!keyValid || saving}
            className="rounded bg-[#ff007c] px-4 py-2 text-sm text-white disabled:opacity-40"
          >
            {saving ? 'Creando...' : 'Crear'}
          </button>
        </div>
      </div>
    </div>
  )
}
