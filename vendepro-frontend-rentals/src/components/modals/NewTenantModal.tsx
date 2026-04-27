'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { apiFetch } from '@/lib/api'

export default function NewTenantModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    person_type: 'fisica',
    name: '', last_name: '', email: '', phone: '', dni_cuit: '',
    birth_date: '', nationality: '', marital_status: '', occupation: '', notes: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function save() {
    if (!form.name || !form.last_name) { setError('Nombre y apellido son obligatorios'); return }
    setSaving(true)
    setError('')
    try {
      await apiFetch('/tenants', { method: 'POST', body: JSON.stringify(form) })
      onCreated()
    } catch (e: any) { setError(e.message || 'Error al guardar') } finally { setSaving(false) }
  }

  const f = (key: string, val: string) => setForm(p => ({ ...p, [key]: val }))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Nuevo inquilino</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X size={18} /></button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
          <div className="flex gap-2">
            {[['fisica', 'Persona física'], ['juridica', 'Persona jurídica']].map(([v, l]) => (
              <button key={v} onClick={() => f('person_type', v)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${form.person_type === v ? 'border-[#ff007c] bg-[#ff007c]/10 text-[#ff007c]' : 'border-gray-200 text-gray-600'}`}>
                {l}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Nombre *</label><input className="input" value={form.name} onChange={e => f('name', e.target.value)} /></div>
            <div><label className="label">Apellido *</label><input className="input" value={form.last_name} onChange={e => f('last_name', e.target.value)} /></div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Email</label><input className="input" type="email" value={form.email} onChange={e => f('email', e.target.value)} /></div>
            <div><label className="label">Teléfono</label><input className="input" value={form.phone} onChange={e => f('phone', e.target.value)} /></div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">DNI / CUIT</label><input className="input" value={form.dni_cuit} onChange={e => f('dni_cuit', e.target.value)} /></div>
            <div><label className="label">Fecha nacimiento</label><input type="date" className="input" value={form.birth_date} onChange={e => f('birth_date', e.target.value)} /></div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Nacionalidad</label><input className="input" value={form.nationality} onChange={e => f('nationality', e.target.value)} /></div>
            <div>
              <label className="label">Estado civil</label>
              <select className="input" value={form.marital_status} onChange={e => f('marital_status', e.target.value)}>
                <option value="">—</option>
                {['soltero/a', 'casado/a', 'divorciado/a', 'viudo/a', 'conviviente'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div><label className="label">Ocupación</label><input className="input" value={form.occupation} onChange={e => f('occupation', e.target.value)} /></div>
          <div><label className="label">Notas</label><textarea className="input" rows={2} value={form.notes} onChange={e => f('notes', e.target.value)} /></div>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <div className="px-5 py-4 border-t border-gray-100 flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
          <button onClick={save} disabled={saving} className="btn-primary flex-1">{saving ? 'Guardando...' : 'Guardar'}</button>
        </div>
      </div>
    </div>
  )
}
