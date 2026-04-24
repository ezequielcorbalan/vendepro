'use client'

import { useEffect, useState } from 'react'
import { X, Plus, Trash2 } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { PROPERTY_TYPES } from '@/lib/constants'

export default function NewPropertyModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    address: '', floor_unit: '', property_type: '', city: '', province: '', postal_code: '', surface_m2: '',
  })
  const [owners, setOwners] = useState<Array<{ landlord_id: string; participation_percentage: number }>>([])
  const [landlords, setLandlords] = useState<any[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    apiFetch('/landlords').then(d => setLandlords(d.landlords || d || [])).catch(() => {})
  }, [])

  function addOwner() { setOwners(o => [...o, { landlord_id: '', participation_percentage: 100 }]) }
  function removeOwner(idx: number) { setOwners(o => o.filter((_, i) => i !== idx)) }
  function updateOwner(idx: number, key: string, val: string | number) {
    setOwners(o => o.map((item, i) => i === idx ? { ...item, [key]: val } : item))
  }

  async function save() {
    if (!form.address) { setError('La dirección es obligatoria'); return }
    const totalPct = owners.reduce((s, o) => s + (o.participation_percentage || 0), 0)
    if (owners.length > 0 && Math.abs(totalPct - 100) > 0.1) { setError(`Los porcentajes deben sumar 100% (actual: ${totalPct}%)`); return }
    setSaving(true)
    setError('')
    try {
      await apiFetch('/rental-properties', {
        method: 'POST',
        body: JSON.stringify({ ...form, surface_m2: form.surface_m2 ? Number(form.surface_m2) : undefined, owners }),
      })
      onCreated()
    } catch (e: any) { setError(e.message || 'Error al guardar') } finally { setSaving(false) }
  }

  const f = (key: string, val: string) => setForm(p => ({ ...p, [key]: val }))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Nueva propiedad</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X size={18} /></button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
          <div><label className="label">Dirección *</label><input className="input" value={form.address} onChange={e => f('address', e.target.value)} placeholder="Av. Corrientes 1234" /></div>

          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Piso/Dpto</label><input className="input" value={form.floor_unit} onChange={e => f('floor_unit', e.target.value)} placeholder="2° B" /></div>
            <div>
              <label className="label">Tipo</label>
              <select className="input" value={form.property_type} onChange={e => f('property_type', e.target.value)}>
                <option value="">Seleccionar...</option>
                {PROPERTY_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div><label className="label">Ciudad</label><input className="input" value={form.city} onChange={e => f('city', e.target.value)} /></div>
            <div><label className="label">Provincia</label><input className="input" value={form.province} onChange={e => f('province', e.target.value)} /></div>
            <div><label className="label">CP</label><input className="input" value={form.postal_code} onChange={e => f('postal_code', e.target.value)} /></div>
          </div>

          <div><label className="label">Superficie (m²)</label><input type="number" className="input" value={form.surface_m2} onChange={e => f('surface_m2', e.target.value)} /></div>

          {/* Owners */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="label mb-0">Propietarios</label>
              <button onClick={addOwner} className="text-xs text-pink-600 hover:underline flex items-center gap-1"><Plus size={12} /> Agregar</button>
            </div>
            {owners.map((o, idx) => (
              <div key={idx} className="flex gap-2 mb-2">
                <select className="input flex-1" value={o.landlord_id} onChange={e => updateOwner(idx, 'landlord_id', e.target.value)}>
                  <option value="">Seleccionar propietario...</option>
                  {landlords.map(l => <option key={l.id} value={l.id}>{l.name} {l.last_name}</option>)}
                </select>
                <input type="number" className="input w-20" value={o.participation_percentage} onChange={e => updateOwner(idx, 'participation_percentage', Number(e.target.value))} min="0" max="100" />
                <span className="text-sm text-gray-400 self-center">%</span>
                <button onClick={() => removeOwner(idx)} className="text-gray-300 hover:text-red-500"><Trash2 size={15} /></button>
              </div>
            ))}
            {owners.length > 0 && (
              <div className="text-xs text-gray-400">Total: {owners.reduce((s, o) => s + (o.participation_percentage || 0), 0)}%</div>
            )}
          </div>

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
