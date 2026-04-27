'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { EXPENSE_CATEGORIES, PAYMENT_METHODS } from '@/lib/constants'

export default function NewExpenseModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [rentals, setRentals] = useState<any[]>([])
  const [properties, setProperties] = useState<any[]>([])
  const [accounts, setAccounts] = useState<any[]>([])
  const [form, setForm] = useState({
    description: '',
    category: '',
    expense_date: new Date().toISOString().slice(0, 10),
    amount: '',
    payment_method: 'transferencia',
    financial_account_id: '',
    linked_to: 'general',
    rental_id: '',
    property_id: '',
    provider: '',
    notes: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([
      apiFetch('/rentals').then(d => setRentals(d.rentals || d || [])).catch(() => {}),
      apiFetch('/rental-properties').then(d => setProperties(d.properties || d || [])).catch(() => {}),
      apiFetch('/financial-accounts').then(d => setAccounts(d.accounts || d || [])).catch(() => {}),
    ])
  }, [])

  async function save() {
    if (!form.description || !form.amount) { setError('Completá los campos obligatorios'); return }
    setSaving(true)
    setError('')
    try {
      await apiFetch('/expenses', { method: 'POST', body: JSON.stringify({ ...form, amount: Number(form.amount) }) })
      onCreated()
    } catch (e: any) { setError(e.message || 'Error al guardar') } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Nuevo gasto</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X size={18} /></button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
          <div>
            <label className="label">Descripción *</label>
            <input className="input" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Reparación de caño..." />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Categoría</label>
              <select className="input" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                <option value="">Sin categoría</option>
                {EXPENSE_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Fecha</label>
              <input type="date" className="input" value={form.expense_date} onChange={e => setForm(f => ({ ...f, expense_date: e.target.value }))} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Monto *</label>
              <input type="number" className="input" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0" />
            </div>
            <div>
              <label className="label">Método de pago</label>
              <select className="input" value={form.payment_method} onChange={e => setForm(f => ({ ...f, payment_method: e.target.value }))}>
                {PAYMENT_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="label">Vinculado a</label>
            <div className="flex gap-2">
              {[['general', 'General'], ['contrato', 'Contrato'], ['propiedad', 'Propiedad']].map(([v, l]) => (
                <button key={v} onClick={() => setForm(f => ({ ...f, linked_to: v }))}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${form.linked_to === v ? 'border-[#ff007c] bg-[#ff007c]/10 text-[#ff007c]' : 'border-gray-200 text-gray-600'}`}>
                  {l}
                </button>
              ))}
            </div>
          </div>

          {form.linked_to === 'contrato' && (
            <div>
              <label className="label">Contrato</label>
              <select className="input" value={form.rental_id} onChange={e => setForm(f => ({ ...f, rental_id: e.target.value }))}>
                <option value="">Seleccionar...</option>
                {rentals.map(r => <option key={r.id} value={r.id}>{r.alias}</option>)}
              </select>
            </div>
          )}

          {form.linked_to === 'propiedad' && (
            <div>
              <label className="label">Propiedad</label>
              <select className="input" value={form.property_id} onChange={e => setForm(f => ({ ...f, property_id: e.target.value }))}>
                <option value="">Seleccionar...</option>
                {properties.map(p => <option key={p.id} value={p.id}>{p.address}</option>)}
              </select>
            </div>
          )}

          <div>
            <label className="label">Proveedor</label>
            <input className="input" value={form.provider} onChange={e => setForm(f => ({ ...f, provider: e.target.value }))} placeholder="Nombre del proveedor" />
          </div>

          <div>
            <label className="label">Notas</label>
            <textarea className="input" rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <div className="px-5 py-4 border-t border-gray-100 flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
          <button onClick={save} disabled={saving} className="btn-primary flex-1">{saving ? 'Guardando...' : 'Guardar gasto'}</button>
        </div>
      </div>
    </div>
  )
}
