'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { PAYMENT_TYPES, PAYMENT_METHODS } from '@/lib/constants'

export default function NewPaymentModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [rentals, setRentals] = useState<any[]>([])
  const [accounts, setAccounts] = useState<any[]>([])
  const [form, setForm] = useState({
    payment_type: 'alquiler',
    description: 'Alquiler',
    rental_id: '',
    payment_date: new Date().toISOString().slice(0, 10),
    amount: '',
    payment_method: 'transferencia',
    financial_account_id: '',
    is_split: false,
    part1_amount: '',
    part1_method: 'transferencia',
    part1_account_id: '',
    part1_date: new Date().toISOString().slice(0, 10),
    part2_amount: '',
    part2_method: 'efectivo',
    part2_account_id: '',
    part2_date: new Date().toISOString().slice(0, 10),
    notes: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([
      apiFetch('/rentals').then(d => setRentals(d.rentals || d || [])).catch(() => {}),
      apiFetch('/financial-accounts').then(d => setAccounts(d.accounts || d || [])).catch(() => {}),
    ])
  }, [])

  function handleTypeChange(type: string) {
    const labels: Record<string, string> = { alquiler: 'Alquiler', llave: 'Llave', expensas: 'Expensas', deposito: 'Depósito', otros: 'Otros' }
    setForm(f => ({ ...f, payment_type: type, description: labels[type] || type }))
  }

  async function save() {
    if (!form.rental_id || !form.amount) { setError('Completá los campos obligatorios'); return }
    setSaving(true)
    setError('')
    try {
      const body: any = {
        ...form,
        amount: Number(form.amount),
        is_split: form.is_split ? 1 : 0,
        part1_amount: form.part1_amount ? Number(form.part1_amount) : undefined,
        part2_amount: form.part2_amount ? Number(form.part2_amount) : undefined,
      }
      await apiFetch('/payments', { method: 'POST', body: JSON.stringify(body) })
      onCreated()
    } catch (e: any) { setError(e.message || 'Error al guardar') } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Nuevo cobro</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X size={18} /></button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
          {/* Type */}
          <div>
            <label className="label">Tipo de cobro</label>
            <div className="flex gap-2 flex-wrap">
              {PAYMENT_TYPES.map(t => (
                <button key={t.value} onClick={() => handleTypeChange(t.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${form.payment_type === t.value ? 'border-[#ff007c] bg-[#ff007c]/10 text-[#ff007c]' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="label">Descripción</label>
            <input className="input" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>

          <div>
            <label className="label">Contrato *</label>
            <select className="input" value={form.rental_id} onChange={e => setForm(f => ({ ...f, rental_id: e.target.value }))}>
              <option value="">Seleccionar contrato...</option>
              {rentals.filter(r => r.status === 'activo' || r.status === 'por_vencer').map(r => (
                <option key={r.id} value={r.id}>{r.alias} — {r.currency} ${Number(r.current_price).toLocaleString('es-AR')}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Monto *</label>
              <input type="number" className="input" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0" />
            </div>
            <div>
              <label className="label">Fecha</label>
              <input type="date" className="input" value={form.payment_date} onChange={e => setForm(f => ({ ...f, payment_date: e.target.value }))} />
            </div>
          </div>

          {!form.is_split && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Método</label>
                <select className="input" value={form.payment_method} onChange={e => setForm(f => ({ ...f, payment_method: e.target.value }))}>
                  {PAYMENT_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Cuenta</label>
                <select className="input" value={form.financial_account_id} onChange={e => setForm(f => ({ ...f, financial_account_id: e.target.value }))}>
                  <option value="">Sin cuenta</option>
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
            </div>
          )}

          {/* Split toggle */}
          <div className="flex items-center gap-2">
            <button onClick={() => setForm(f => ({ ...f, is_split: !f.is_split }))}
              className={`w-10 h-5 rounded-full transition-all ${form.is_split ? 'bg-[#ff007c]' : 'bg-gray-200'}`}>
              <div className={`w-4 h-4 bg-white rounded-full shadow mx-0.5 transition-all ${form.is_split ? 'translate-x-5' : ''}`} />
            </button>
            <span className="text-sm text-gray-700">Pago dividido</span>
          </div>

          {form.is_split && (
            <div className="space-y-3 p-3 bg-gray-50 rounded-lg">
              {(['part1', 'part2'] as const).map(part => (
                <div key={part} className="space-y-2">
                  <div className="text-xs font-semibold text-gray-500 uppercase">{part === 'part1' ? 'Parte 1' : 'Parte 2'}</div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="label">Monto</label>
                      <input type="number" className="input" value={form[`${part}_amount`]} onChange={e => setForm(f => ({ ...f, [`${part}_amount`]: e.target.value }))} />
                    </div>
                    <div>
                      <label className="label">Fecha</label>
                      <input type="date" className="input" value={form[`${part}_date`]} onChange={e => setForm(f => ({ ...f, [`${part}_date`]: e.target.value }))} />
                    </div>
                    <div>
                      <label className="label">Método</label>
                      <select className="input" value={form[`${part}_method`]} onChange={e => setForm(f => ({ ...f, [`${part}_method`]: e.target.value }))}>
                        {PAYMENT_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="label">Cuenta</label>
                      <select className="input" value={form[`${part}_account_id`]} onChange={e => setForm(f => ({ ...f, [`${part}_account_id`]: e.target.value }))}>
                        <option value="">Sin cuenta</option>
                        {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              ))}
              {form.part1_amount && form.part2_amount && (
                <div className="text-sm text-gray-700 font-medium">
                  Total: ${(Number(form.part1_amount) + Number(form.part2_amount)).toLocaleString('es-AR')}
                </div>
              )}
            </div>
          )}

          <div>
            <label className="label">Notas</label>
            <textarea className="input" rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <div className="px-5 py-4 border-t border-gray-100 flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
          <button onClick={save} disabled={saving} className="btn-primary flex-1">{saving ? 'Guardando...' : 'Guardar cobro'}</button>
        </div>
      </div>
    </div>
  )
}
