'use client'

import { useEffect, useState } from 'react'
import { Settings, CreditCard, Sliders, Plus, Trash2, ChevronDown, ChevronRight, X } from 'lucide-react'
import { apiFetch } from '@/lib/api'

// ── Financial Accounts ────────────────────────────────────────────────────────

const ACCOUNT_TYPES = ['efectivo', 'banco', 'mercado_pago', 'otro']

function AccountsSection() {
  const [accounts, setAccounts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', account_type: 'banco', bank_name: '', cbu: '', bank_alias: '', initial_balance: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try { const d = await apiFetch('/financial-accounts'); setAccounts(d.accounts || d || []) }
    catch { setAccounts([]) }
    setLoading(false)
  }

  async function save() {
    if (!form.name) { setError('El nombre es obligatorio'); return }
    setSaving(true); setError('')
    try {
      await apiFetch('/financial-accounts', {
        method: 'POST',
        body: JSON.stringify({ ...form, initial_balance: form.initial_balance ? Number(form.initial_balance) : 0 }),
      })
      setShowForm(false)
      setForm({ name: '', account_type: 'banco', bank_name: '', cbu: '', bank_alias: '', initial_balance: '' })
      load()
    } catch (e: any) { setError(e.message || 'Error al guardar') }
    setSaving(false)
  }

  async function remove(id: string) {
    if (!confirm('¿Eliminar esta cuenta?')) return
    try { await apiFetch(`/financial-accounts/${id}`, { method: 'DELETE' }); load() } catch {}
  }

  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))

  return (
    <div className="bg-white rounded-xl border border-gray-100">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <CreditCard size={16} className="text-gray-400" />
          <span className="text-sm font-semibold text-gray-900">Cuentas financieras</span>
        </div>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-1 text-xs font-medium text-pink-600 hover:underline">
          <Plus size={13} /> Nueva cuenta
        </button>
      </div>

      {showForm && (
        <div className="border-b border-gray-100 px-5 py-4 bg-gray-50">
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div><label className="label">Nombre *</label><input className="input" value={form.name} onChange={e => f('name', e.target.value)} placeholder="Ej: Cuenta BNA" /></div>
            <div>
              <label className="label">Tipo</label>
              <select className="input" value={form.account_type} onChange={e => f('account_type', e.target.value)}>
                {ACCOUNT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div><label className="label">Banco</label><input className="input" value={form.bank_name} onChange={e => f('bank_name', e.target.value)} /></div>
            <div><label className="label">CBU</label><input className="input" value={form.cbu} onChange={e => f('cbu', e.target.value)} /></div>
            <div><label className="label">Alias</label><input className="input" value={form.bank_alias} onChange={e => f('bank_alias', e.target.value)} /></div>
            <div><label className="label">Saldo inicial</label><input type="number" className="input" value={form.initial_balance} onChange={e => f('initial_balance', e.target.value)} placeholder="0" /></div>
          </div>
          {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
          <div className="flex gap-2">
            <button className="btn-secondary text-xs" onClick={() => { setShowForm(false); setError('') }}>Cancelar</button>
            <button className="btn-primary text-xs" disabled={saving} onClick={save}>{saving ? 'Guardando...' : 'Guardar cuenta'}</button>
          </div>
        </div>
      )}

      {loading ? <div className="px-5 py-6 text-sm text-gray-400">Cargando...</div>
      : accounts.length === 0 ? <div className="px-5 py-6 text-sm text-gray-400">No hay cuentas configuradas</div>
      : (
        <div className="divide-y divide-gray-50">
          {accounts.map(a => (
            <div key={a.id} className="px-5 py-3 flex items-center justify-between text-sm">
              <div>
                <div className="font-medium text-gray-900">{a.name}</div>
                <div className="text-xs text-gray-500 capitalize">{a.account_type}{a.bank_name ? ` · ${a.bank_name}` : ''}{a.bank_alias ? ` · ${a.bank_alias}` : ''}</div>
              </div>
              <div className="flex items-center gap-4">
                {a.initial_balance !== undefined && (
                  <span className="text-sm font-medium text-gray-700">${Number(a.initial_balance).toLocaleString('es-AR')}</span>
                )}
                <button onClick={() => remove(a.id)} className="text-gray-300 hover:text-red-500 transition-colors"><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Custom Indices ─────────────────────────────────────────────────────────────

function CustomIndexRow({ index, onDeleted }: { index: any; onDeleted: () => void }) {
  const [open, setOpen] = useState(false)
  const [values, setValues] = useState<any[]>([])
  const [loadingVals, setLoadingVals] = useState(false)
  const [showValForm, setShowValForm] = useState(false)
  const [valForm, setValForm] = useState({ value_date: new Date().toISOString().slice(0, 7), value: '' })

  async function loadValues() {
    if (!open) {
      setLoadingVals(true)
      try { const d = await apiFetch(`/custom-indices/${index.id}/values`); setValues(d.values || d || []) }
      catch { setValues([]) }
      setLoadingVals(false)
    }
    setOpen(o => !o)
  }

  async function addValue() {
    if (!valForm.value) return
    try {
      await apiFetch(`/custom-indices/${index.id}/values`, {
        method: 'POST',
        body: JSON.stringify({ value_date: valForm.value_date + '-01', value: Number(valForm.value) }),
      })
      const d = await apiFetch(`/custom-indices/${index.id}/values`)
      setValues(d.values || d || [])
      setShowValForm(false)
      setValForm({ value_date: new Date().toISOString().slice(0, 7), value: '' })
    } catch {}
  }

  async function remove() {
    if (!confirm(`¿Eliminar el índice "${index.name}"?`)) return
    try { await apiFetch(`/custom-indices/${index.id}`, { method: 'DELETE' }); onDeleted() } catch {}
  }

  return (
    <div className="border-b border-gray-50 last:border-0">
      <div className="flex items-center justify-between px-5 py-3 text-sm">
        <button onClick={loadValues} className="flex items-center gap-2 flex-1 text-left">
          {open ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-400" />}
          <div>
            <div className="font-medium text-gray-900">{index.name}</div>
            {index.description && <div className="text-xs text-gray-500">{index.description}</div>}
          </div>
        </button>
        <button onClick={remove} className="text-gray-300 hover:text-red-500 ml-3"><Trash2 size={14} /></button>
      </div>

      {open && (
        <div className="mx-5 mb-3 bg-gray-50 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-500 uppercase">Historial de valores</span>
            <button onClick={() => setShowValForm(s => !s)} className="text-xs text-pink-600 hover:underline flex items-center gap-1"><Plus size={11} /> Agregar valor</button>
          </div>
          {showValForm && (
            <div className="flex gap-2 mb-3">
              <div className="flex-1"><label className="label text-xs">Período (mes)</label><input type="month" className="input text-xs py-1" value={valForm.value_date} onChange={e => setValForm(f => ({...f, value_date: e.target.value}))} /></div>
              <div className="flex-1"><label className="label text-xs">Valor (%)</label><input type="number" className="input text-xs py-1" value={valForm.value} onChange={e => setValForm(f => ({...f, value: e.target.value}))} placeholder="0.00" /></div>
              <div className="flex items-end gap-1">
                <button className="btn-primary text-xs py-1 px-2" onClick={addValue}>OK</button>
                <button className="btn-secondary text-xs py-1 px-2" onClick={() => setShowValForm(false)}><X size={12} /></button>
              </div>
            </div>
          )}
          {loadingVals ? <div className="text-xs text-gray-400 py-2">Cargando...</div>
          : values.length === 0 ? <div className="text-xs text-gray-400 py-2">Sin valores cargados</div>
          : (
            <table className="w-full text-xs">
              <thead><tr className="border-b border-gray-200"><th className="text-left py-1 text-gray-500">Período</th><th className="text-right py-1 text-gray-500">Valor (%)</th></tr></thead>
              <tbody>
                {values.slice().reverse().map((v: any) => (
                  <tr key={v.id} className="border-b border-gray-100">
                    <td className="py-1 text-gray-700">{v.value_date?.slice(0, 7)}</td>
                    <td className="py-1 text-right font-medium text-gray-900">{Number(v.value).toFixed(2)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}

function IndicesSection() {
  const [indices, setIndices] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', description: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try { const d = await apiFetch('/custom-indices'); setIndices(d.indices || d || []) }
    catch { setIndices([]) }
    setLoading(false)
  }

  async function save() {
    if (!form.name) return
    setSaving(true)
    try {
      await apiFetch('/custom-indices', { method: 'POST', body: JSON.stringify(form) })
      setShowForm(false)
      setForm({ name: '', description: '' })
      load()
    } catch {}
    setSaving(false)
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <Sliders size={16} className="text-gray-400" />
          <span className="text-sm font-semibold text-gray-900">Índices personalizados de ajuste</span>
        </div>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-1 text-xs font-medium text-pink-600 hover:underline">
          <Plus size={13} /> Nuevo índice
        </button>
      </div>

      {showForm && (
        <div className="border-b border-gray-100 px-5 py-4 bg-gray-50">
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div><label className="label">Nombre *</label><input className="input" value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} placeholder="Ej: Índice casa propia" /></div>
            <div><label className="label">Descripción</label><input className="input" value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))} /></div>
          </div>
          <div className="flex gap-2">
            <button className="btn-secondary text-xs" onClick={() => setShowForm(false)}>Cancelar</button>
            <button className="btn-primary text-xs" disabled={saving} onClick={save}>{saving ? 'Guardando...' : 'Crear índice'}</button>
          </div>
        </div>
      )}

      {loading ? <div className="px-5 py-6 text-sm text-gray-400">Cargando...</div>
      : indices.length === 0 ? <div className="px-5 py-6 text-sm text-gray-400">No hay índices configurados</div>
      : indices.map(i => <CustomIndexRow key={i.id} index={i} onDeleted={load} />)}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AccountPage() {
  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-2 mb-6">
        <Settings size={18} className="text-pink-500" />
        <h1 className="text-xl font-semibold text-gray-900">Preferencias</h1>
      </div>
      <div className="space-y-6">
        <AccountsSection />
        <IndicesSection />
      </div>
    </div>
  )
}
