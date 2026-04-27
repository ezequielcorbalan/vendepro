'use client'
import { useState } from 'react'
import { createVariable } from '../shared/api'

interface Props { onClose: () => void; onCreated: () => void }

const VALUE_TYPES = ['number', 'percent', 'text', 'date', 'image_url'] as const

export function VariableModal({ onClose, onCreated }: Props) {
  const [keySuffix, setKeySuffix] = useState('')
  const [label, setLabel] = useState('')
  const [valueType, setValueType] = useState<typeof VALUE_TYPES[number]>('text')
  const [value, setValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const keyValid = /^[a-z_][a-z0-9_]*$/.test(keySuffix)

  const save = async () => {
    if (!keyValid || saving) return
    setSaving(true)
    setError('')
    try {
      await createVariable({ key: `custom.${keySuffix}`, label, value_type: valueType, value, namespace: 'custom' })
      onCreated()
      onClose()
    } catch (e: any) {
      setError(e?.message ?? 'Error al crear variable')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-lg bg-white p-6">
        <h3 className="text-lg font-semibold">Nueva variable custom</h3>
        <div className="mt-4 space-y-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wide text-slate-600">Key</span>
            <div className="flex items-center gap-0 rounded border border-slate-300 text-sm">
              <span className="bg-slate-100 px-2 py-2 text-slate-500">custom.</span>
              <input value={keySuffix} onChange={e => setKeySuffix(e.target.value)} className="flex-1 px-2 py-2" placeholder="mi_variable" />
            </div>
            {!keyValid && keySuffix && <span className="text-xs text-rose-500">Solo letras, números y _, debe empezar con letra</span>}
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wide text-slate-600">Label</span>
            <input value={label} onChange={e => setLabel(e.target.value)} className="rounded border border-slate-300 px-3 py-2 text-sm" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wide text-slate-600">Tipo</span>
            <select value={valueType} onChange={e => setValueType(e.target.value as typeof VALUE_TYPES[number])} className="rounded border border-slate-300 px-3 py-2 text-sm">
              {VALUE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wide text-slate-600">Valor inicial</span>
            <input value={value} onChange={e => setValue(e.target.value)} className="rounded border border-slate-300 px-3 py-2 text-sm" />
          </label>
        </div>
        {error && <p className="mt-3 text-xs text-rose-500">{error}</p>}
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="rounded px-4 py-2 text-sm">Cancelar</button>
          <button onClick={save} disabled={!keyValid || saving} className="rounded bg-[#ff007c] px-4 py-2 text-sm text-white disabled:opacity-40">
            {saving ? 'Creando...' : 'Crear'}
          </button>
        </div>
      </div>
    </div>
  )
}
