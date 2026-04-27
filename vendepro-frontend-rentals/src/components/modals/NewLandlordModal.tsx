'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { apiFetch } from '@/lib/api'

export default function NewLandlordModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    person_type: 'fisica',
    name: '', last_name: '', email: '', phone: '', cuit: '',
    company_name: '', address: '', cbu: '', bank_alias: '',
    admin_fee_percentage: '', notes: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function save() {
    if (!form.name || !form.last_name) { setError('Nombre y apellido son obligatorios'); return }
    setSaving(true)
    setError('')
    try {
      await apiFetch('/landlords', { method: 'POST', body: JSON.stringify({ ...form, admin_fee_percentage: form.admin_fee_percentage ? Number(form.admin_fee_percentage) : 0 }) })
      onCreated()
    } catch (e: any) { setError(e.message || 'Error al guardar') } finally { setSaving(false) }
  }

  const f = (key: string, val: string) => setForm(p => ({ ...p, [key]: val }))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Nuevo propietario</h2>
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

          {form.person_type === 'juridica' && (
            <div><label className="label">Razón social</label><input className="input" value={form.company_name} onChange={e => f('company_name', e.target.value)} /></div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Email</label><input className="input" type="email" value={form.email} onChange={e => f('email', e.target.value)} /></div>
            <div><label className="label">Teléfono</label><input className="input" value={form.phone} onChange={e => f('phone', e.target.value)} /></div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">CUIT</label><input className="input" value={form.cuit} onChange={e => f('cuit', e.target.value)} /></div>
            <div><label className="label">% Honorarios</label><input className="input" type="number" min="0" max="100" value={form.admin_fee_percentage} onChange={e => f('admin_fee_percentage', e.target.value)} placeholder="0" /></div>
          </div>

          <div><label className="label">Domicilio</label><input className="input" value={form.address} onChange={e => f('address', e.target.value)} /></div>

          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">CBU</label><input className="input" value={form.cbu} onChange={e => f('cbu', e.target.value)} /></div>
            <div><label className="label">Alias bancario</label><input className="input" value={form.bank_alias} onChange={e => f('bank_alias', e.target.value)} /></div>
          </div>

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
