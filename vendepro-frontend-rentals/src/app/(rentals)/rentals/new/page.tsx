'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ArrowRight, Check, Plus, Trash2, Sparkles, Upload, FileSpreadsheet, FileText as FileTextIcon } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { API_BASE } from '@/lib/constants'
import { getAuthHeaders } from '@/lib/auth'
import {
  RENTAL_TYPES, CURRENCIES, ADJUSTMENT_FREQUENCIES, ADJUSTMENT_TYPES,
  GUARANTEE_TYPES,
} from '@/lib/constants'

const STEPS = ['Datos básicos', 'Propiedades', 'Inquilinos', 'Precio', 'Ajustes', 'Garantía', 'Servicios', 'Portal']

type ImportMode = 'manual' | 'ai' | 'csv' | null

export default function NewContractPage() {
  const router = useRouter()
  const [importMode, setImportMode] = useState<ImportMode>(null)
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState('')
  const [csvError, setCsvError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const csvRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState({
    alias: '',
    rental_type: 'residencial',
    start_date: '',
    duration_months: 24,
    payment_day: 1,
    currency: 'ARS',
    end_date: '',
    initial_price: '',
    applies_iva: false,
    deposit_months: 1,
    adjustment_frequency: 'cuatrimestral',
    adjustment_type: 'icl',
    adjustment_fixed_rate: '',
    guarantee_type: 'sin_garantia',
    co_signer_id: '',
    portal_active: false,
    portal_pin: '',
    notes: '',
    services: [] as string[],
    properties: [] as string[],
    tenants: [] as string[],
  })

  const [allProperties, setAllProperties] = useState<any[]>([])
  const [allTenants, setAllTenants] = useState<any[]>([])
  const [allCoSigners, setAllCoSigners] = useState<any[]>([])
  const [newTenantForm, setNewTenantForm] = useState({ show: false, name: '', last_name: '', email: '', phone: '', dni_cuit: '' })

  useEffect(() => {
    Promise.all([
      apiFetch('/rental-properties').then(d => setAllProperties(d.properties || d || [])).catch(() => {}),
      apiFetch('/tenants').then(d => setAllTenants(d.tenants || d || [])).catch(() => {}),
      apiFetch('/co-signers').then(d => setAllCoSigners(d.co_signers || d || [])).catch(() => {}),
    ])
  }, [])

  useEffect(() => {
    if (form.start_date && form.duration_months) {
      const start = new Date(form.start_date)
      start.setMonth(start.getMonth() + Number(form.duration_months))
      setForm(f => ({ ...f, end_date: start.toISOString().slice(0, 10) }))
    }
  }, [form.start_date, form.duration_months])

  const set = (key: string, val: any) => setForm(f => ({ ...f, [key]: val }))

  function validateStep(): boolean {
    setError('')
    if (step === 0 && (!form.alias || !form.start_date)) { setError('Alias y fecha de inicio son obligatorios'); return false }
    if (step === 3 && !form.initial_price) { setError('Precio inicial es obligatorio'); return false }
    return true
  }

  function toggleProperty(id: string) {
    setForm(f => ({
      ...f,
      properties: f.properties.includes(id) ? f.properties.filter(x => x !== id) : [...f.properties, id],
    }))
  }

  function toggleTenant(id: string) {
    setForm(f => ({
      ...f,
      tenants: f.tenants.includes(id) ? f.tenants.filter(x => x !== id) : [...f.tenants, id],
    }))
  }

  function toggleService(name: string) {
    setForm(f => ({
      ...f,
      services: f.services.includes(name) ? f.services.filter(x => x !== name) : [...f.services, name],
    }))
  }

  async function addInlineTenant() {
    if (!newTenantForm.name || !newTenantForm.last_name) return
    try {
      const t = await apiFetch('/tenants', { method: 'POST', body: JSON.stringify(newTenantForm) })
      setAllTenants(prev => [...prev, t])
      setForm(f => ({ ...f, tenants: [...f.tenants, t.id] }))
      setNewTenantForm({ show: false, name: '', last_name: '', email: '', phone: '', dni_cuit: '' })
    } catch {}
  }

  async function extractWithAI(file: File) {
    setAiLoading(true)
    setAiError('')
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch(`${API_BASE}/contracts/extract-from-file`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: fd,
      })
      const data = await res.json() as any
      if (!res.ok) throw new Error(data.error || 'Error al procesar')
      // Merge extracted fields into form
      setForm(f => ({
        ...f,
        alias: data.alias || f.alias,
        rental_type: data.rental_type || f.rental_type,
        start_date: data.start_date || f.start_date,
        duration_months: data.duration_months || f.duration_months,
        initial_price: data.initial_price ? String(data.initial_price) : f.initial_price,
        currency: data.currency || f.currency,
        payment_day: data.payment_day || f.payment_day,
        adjustment_type: data.adjustment_type || f.adjustment_type,
        notes: data.notes || f.notes,
      }))
      setImportMode('manual')
    } catch (e: any) {
      setAiError(e.message || 'No se pudo extraer datos del archivo')
    }
    setAiLoading(false)
  }

  function parseCSV(text: string) {
    try {
      const lines = text.trim().split('\n')
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/\s+/g, '_'))
      const rows = lines.slice(1).map(line => {
        const vals = line.split(',')
        const obj: Record<string, string> = {}
        headers.forEach((h, i) => { obj[h] = (vals[i] || '').trim() })
        return obj
      })
      // Take first row and try to map fields
      const r = rows[0]
      if (!r) throw new Error('CSV vacío')
      setForm(f => ({
        ...f,
        alias: r.alias || r.nombre || r.contrato || f.alias,
        start_date: r.fecha_inicio || r.inicio || f.start_date,
        duration_months: r.duracion_meses ? Number(r.duracion_meses) : f.duration_months,
        initial_price: r.precio || r.monto || r.precio_inicial || f.initial_price,
        currency: r.moneda || f.currency,
        payment_day: r.dia_pago ? Number(r.dia_pago) : f.payment_day,
      }))
      setImportMode('manual')
    } catch (e: any) {
      setCsvError(e.message || 'Error al parsear CSV')
    }
  }

  async function submit() {
    setSaving(true)
    setError('')
    try {
      const r = await apiFetch('/rentals', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          initial_price: Number(form.initial_price),
          current_price: Number(form.initial_price),
          applies_iva: form.applies_iva ? 1 : 0,
          portal_active: form.portal_active ? 1 : 0,
          adjustment_fixed_rate: form.adjustment_fixed_rate ? Number(form.adjustment_fixed_rate) : undefined,
        }),
      })
      router.push(`/rentals/${r.id || r.rental?.id}`)
    } catch (e: any) { setError(e.message || 'Error al crear contrato'); setSaving(false) }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-2 mb-6">
        <button onClick={() => router.push('/rentals')} className="text-gray-400 hover:text-gray-700"><ArrowLeft size={18} /></button>
        <h1 className="text-xl font-semibold text-gray-900">Nuevo contrato</h1>
      </div>

      {/* Pre-selector */}
      {importMode === null && (
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-1">¿Cómo querés cargar el contrato?</h2>
          <p className="text-xs text-gray-500 mb-5">Elegí el método de ingreso de datos</p>
          <div className="grid grid-cols-3 gap-4">
            {/* Manual */}
            <button onClick={() => setImportMode('manual')}
              className="flex flex-col items-center gap-3 p-5 border-2 border-gray-200 rounded-xl hover:border-pink-300 hover:bg-pink-50/30 transition-all group">
              <div className="w-12 h-12 rounded-xl bg-gray-100 group-hover:bg-pink-100 flex items-center justify-center transition-all">
                <FileTextIcon size={22} className="text-gray-500 group-hover:text-pink-600" />
              </div>
              <div className="text-center">
                <div className="text-sm font-semibold text-gray-900">Manual</div>
                <div className="text-xs text-gray-500 mt-0.5">Completá el formulario paso a paso</div>
              </div>
            </button>

            {/* IA */}
            <button onClick={() => setImportMode('ai')}
              className="flex flex-col items-center gap-3 p-5 border-2 border-gray-200 rounded-xl hover:border-purple-300 hover:bg-purple-50/30 transition-all group relative">
              <div className="absolute -top-2 -right-2 bg-purple-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">IA</div>
              <div className="w-12 h-12 rounded-xl bg-gray-100 group-hover:bg-purple-100 flex items-center justify-center transition-all">
                <Sparkles size={22} className="text-gray-500 group-hover:text-purple-600" />
              </div>
              <div className="text-center">
                <div className="text-sm font-semibold text-gray-900">Con IA</div>
                <div className="text-xs text-gray-500 mt-0.5">Subí imagen o PDF del contrato</div>
              </div>
            </button>

            {/* CSV */}
            <button onClick={() => setImportMode('csv')}
              className="flex flex-col items-center gap-3 p-5 border-2 border-gray-200 rounded-xl hover:border-green-300 hover:bg-green-50/30 transition-all group">
              <div className="w-12 h-12 rounded-xl bg-gray-100 group-hover:bg-green-100 flex items-center justify-center transition-all">
                <FileSpreadsheet size={22} className="text-gray-500 group-hover:text-green-600" />
              </div>
              <div className="text-center">
                <div className="text-sm font-semibold text-gray-900">Importar CSV</div>
                <div className="text-xs text-gray-500 mt-0.5">Desde Excel o planilla</div>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* AI upload */}
      {importMode === 'ai' && (
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles size={16} className="text-purple-600" />
            <h2 className="text-sm font-semibold text-gray-900">Importar con IA</h2>
            <button onClick={() => setImportMode(null)} className="ml-auto text-xs text-gray-400 hover:text-gray-600">← Volver</button>
          </div>
          <div
            className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center cursor-pointer hover:border-purple-300 hover:bg-purple-50/20 transition-all"
            onClick={() => fileRef.current?.click()}
          >
            <Upload size={28} className="mx-auto text-gray-300 mb-3" />
            <div className="text-sm font-medium text-gray-700">Hacé click para subir un archivo</div>
            <div className="text-xs text-gray-400 mt-1">PDF, imagen (JPG, PNG) — max 10MB</div>
            <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) extractWithAI(f) }} />
          </div>
          {aiLoading && (
            <div className="mt-4 flex items-center gap-2 text-sm text-purple-600">
              <div className="w-4 h-4 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
              Analizando el documento con IA...
            </div>
          )}
          {aiError && <p className="mt-3 text-sm text-red-600">{aiError}</p>}
        </div>
      )}

      {/* CSV upload */}
      {importMode === 'csv' && (
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <div className="flex items-center gap-2 mb-4">
            <FileSpreadsheet size={16} className="text-green-600" />
            <h2 className="text-sm font-semibold text-gray-900">Importar desde CSV</h2>
            <button onClick={() => setImportMode(null)} className="ml-auto text-xs text-gray-400 hover:text-gray-600">← Volver</button>
          </div>
          <div
            className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center cursor-pointer hover:border-green-300 hover:bg-green-50/20 transition-all"
            onClick={() => csvRef.current?.click()}
          >
            <FileSpreadsheet size={28} className="mx-auto text-gray-300 mb-3" />
            <div className="text-sm font-medium text-gray-700">Subí tu archivo CSV o Excel</div>
            <div className="text-xs text-gray-400 mt-1">Columnas esperadas: alias, fecha_inicio, duracion_meses, precio, moneda, dia_pago</div>
            <input ref={csvRef} type="file" accept=".csv,.txt" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) { const r = new FileReader(); r.onload = ev => parseCSV(ev.target?.result as string); r.readAsText(f) }}} />
          </div>
          <div className="mt-4 p-3 bg-gray-50 rounded-lg text-xs text-gray-500">
            <div className="font-semibold mb-1">Formato esperado (primera fila = encabezados):</div>
            <code className="text-xs">alias,fecha_inicio,duracion_meses,precio,moneda,dia_pago</code>
            <div className="mt-1">Ejemplo: <code>Dpto 5A - Corrientes,2026-05-01,24,250000,ARS,1</code></div>
          </div>
          {csvError && <p className="mt-3 text-sm text-red-600">{csvError}</p>}
        </div>
      )}

      {/* Progress */}
      {importMode === 'manual' && <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          {STEPS.map((s, i) => (
            <button key={i} onClick={() => i < step && setStep(i)}
              className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold transition-all ${i < step ? 'cursor-pointer' : 'cursor-default'} ${i === step ? 'text-white' : i < step ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-400'}`}
              style={i === step ? { background: '#ff007c' } : undefined}
            >
              {i < step ? <Check size={13} /> : i + 1}
            </button>
          ))}
        </div>
        <div className="h-1 bg-gray-100 rounded-full">
          <div className="h-1 rounded-full transition-all" style={{ background: '#ff007c', width: `${(step / (STEPS.length - 1)) * 100}%` }} />
        </div>
        <div className="text-xs text-gray-500 mt-1.5">Paso {step + 1} de {STEPS.length}: <span className="font-medium text-gray-700">{STEPS[step]}</span></div>
      </div>}

      {/* Step content */}
      {importMode === 'manual' && <div className="bg-white rounded-xl border border-gray-100 p-6 min-h-[300px]">
        {step === 0 && (
          <div className="space-y-4">
            <div><label className="label">Alias del contrato *</label><input className="input" value={form.alias} onChange={e => set('alias', e.target.value)} placeholder="Ej: Av. Corrientes 1234 - Dpto 3B" /></div>
            <div>
              <label className="label">Tipo de alquiler</label>
              <div className="flex gap-2">
                {RENTAL_TYPES.map(t => (
                  <button key={t.value} onClick={() => set('rental_type', t.value)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${form.rental_type === t.value ? 'border-[#ff007c] bg-[#ff007c]/10 text-[#ff007c]' : 'border-gray-200 text-gray-600'}`}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Fecha inicio *</label><input type="date" className="input" value={form.start_date} onChange={e => set('start_date', e.target.value)} /></div>
              <div>
                <label className="label">Duración (meses)</label>
                <select className="input" value={form.duration_months} onChange={e => set('duration_months', Number(e.target.value))}>
                  {[12, 24, 36, 48, 60].map(m => <option key={m} value={m}>{m} meses ({m/12} {m/12 === 1 ? 'año' : 'años'})</option>)}
                </select>
              </div>
            </div>
            {form.end_date && <div className="text-xs text-gray-500">Fecha de vencimiento calculada: <span className="font-medium text-gray-700">{form.end_date}</span></div>}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Día de pago</label>
                <select className="input" value={form.payment_day} onChange={e => set('payment_day', Number(e.target.value))}>
                  {Array.from({length: 28}, (_, i) => i + 1).map(d => <option key={d} value={d}>Día {d}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Moneda</label>
                <div className="flex gap-2">
                  {CURRENCIES.map(c => (
                    <button key={c.value} onClick={() => set('currency', c.value)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${form.currency === c.value ? 'border-[#ff007c] bg-[#ff007c]/10 text-[#ff007c]' : 'border-gray-200 text-gray-600'}`}>
                      {c.value}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 1 && (
          <div>
            <p className="text-sm text-gray-500 mb-4">Seleccioná las propiedades para este contrato</p>
            <div className="space-y-2">
              {allProperties.length === 0 && <div className="text-sm text-gray-400">No hay propiedades disponibles</div>}
              {allProperties.map(p => {
                const selected = form.properties.includes(p.id)
                const occupied = p.status === 'ocupada'
                return (
                  <button key={p.id} onClick={() => !occupied && toggleProperty(p.id)} disabled={occupied}
                    className={`w-full flex items-center justify-between p-3 rounded-lg border text-left transition-all ${selected ? 'border-[#ff007c] bg-[#ff007c]/5' : occupied ? 'border-gray-100 bg-gray-50 opacity-60 cursor-not-allowed' : 'border-gray-200 hover:border-gray-300'}`}>
                    <div>
                      <div className="text-sm font-medium text-gray-900">{p.address}{p.floor_unit ? ` ${p.floor_unit}` : ''}</div>
                      <div className="text-xs text-gray-400">{p.city} · {p.property_type}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      {occupied && <span className="text-xs text-orange-500">Ocupada</span>}
                      {selected && <Check size={16} color="#ff007c" />}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <p className="text-sm text-gray-500 mb-4">Seleccioná o agregá inquilinos</p>
            <div className="space-y-2 mb-4">
              {allTenants.map(t => {
                const selected = form.tenants.includes(t.id)
                return (
                  <button key={t.id} onClick={() => toggleTenant(t.id)}
                    className={`w-full flex items-center justify-between p-3 rounded-lg border text-left transition-all ${selected ? 'border-[#ff007c] bg-[#ff007c]/5' : 'border-gray-200 hover:border-gray-300'}`}>
                    <div>
                      <div className="text-sm font-medium text-gray-900">{t.name} {t.last_name}</div>
                      <div className="text-xs text-gray-400">{t.email || t.dni_cuit || 'Sin datos'}</div>
                    </div>
                    {selected && <Check size={16} color="#ff007c" />}
                  </button>
                )
              })}
            </div>
            {!newTenantForm.show ? (
              <button onClick={() => setNewTenantForm(f => ({ ...f, show: true }))} className="btn-secondary text-xs w-full">
                <Plus size={13} /> Agregar inquilino nuevo
              </button>
            ) : (
              <div className="border border-gray-200 rounded-lg p-4 space-y-3">
                <div className="text-xs font-semibold text-gray-700">Nuevo inquilino</div>
                <div className="grid grid-cols-2 gap-2">
                  <div><label className="label">Nombre *</label><input className="input" value={newTenantForm.name} onChange={e => setNewTenantForm(f => ({...f, name: e.target.value}))} /></div>
                  <div><label className="label">Apellido *</label><input className="input" value={newTenantForm.last_name} onChange={e => setNewTenantForm(f => ({...f, last_name: e.target.value}))} /></div>
                  <div><label className="label">Email</label><input className="input" value={newTenantForm.email} onChange={e => setNewTenantForm(f => ({...f, email: e.target.value}))} /></div>
                  <div><label className="label">Teléfono</label><input className="input" value={newTenantForm.phone} onChange={e => setNewTenantForm(f => ({...f, phone: e.target.value}))} /></div>
                  <div className="col-span-2"><label className="label">DNI/CUIT</label><input className="input" value={newTenantForm.dni_cuit} onChange={e => setNewTenantForm(f => ({...f, dni_cuit: e.target.value}))} /></div>
                </div>
                <div className="flex gap-2">
                  <button className="btn-secondary text-xs flex-1" onClick={() => setNewTenantForm(f => ({...f, show: false}))}>Cancelar</button>
                  <button className="btn-primary text-xs flex-1" onClick={addInlineTenant}>Agregar</button>
                </div>
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div>
              <label className="label">Precio inicial *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">{form.currency}</span>
                <input type="number" className="input pl-12" value={form.initial_price} onChange={e => set('initial_price', e.target.value)} placeholder="0" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => set('applies_iva', !form.applies_iva)}
                className={`w-10 h-5 rounded-full transition-all ${form.applies_iva ? 'bg-[#ff007c]' : 'bg-gray-200'}`}>
                <div className={`w-4 h-4 bg-white rounded-full shadow mx-0.5 transition-all ${form.applies_iva ? 'translate-x-5' : ''}`} />
              </button>
              <span className="text-sm text-gray-700">Aplica IVA (21%)</span>
            </div>
            {form.applies_iva && form.initial_price && (
              <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
                <div className="flex justify-between text-gray-600"><span>Neto</span><span>${Number(form.initial_price).toLocaleString('es-AR')}</span></div>
                <div className="flex justify-between text-gray-600"><span>IVA 21%</span><span>${(Number(form.initial_price) * 0.21).toLocaleString('es-AR')}</span></div>
                <div className="flex justify-between font-semibold text-gray-900 border-t border-gray-200 pt-1"><span>Total</span><span>${(Number(form.initial_price) * 1.21).toLocaleString('es-AR')}</span></div>
              </div>
            )}
            <div>
              <label className="label">Depósito en garantía (meses)</label>
              <select className="input" value={form.deposit_months} onChange={e => set('deposit_months', Number(e.target.value))}>
                {[0, 0.5, 1, 1.5, 2, 3].map(m => <option key={m} value={m}>{m} {m === 1 ? 'mes' : m === 0 ? 'Sin depósito' : 'meses'}</option>)}
              </select>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <div>
              <label className="label">Frecuencia de ajuste</label>
              <div className="flex gap-2 flex-wrap">
                {ADJUSTMENT_FREQUENCIES.map(f => (
                  <button key={f.value} onClick={() => set('adjustment_frequency', f.value)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${form.adjustment_frequency === f.value ? 'border-[#ff007c] bg-[#ff007c]/10 text-[#ff007c]' : 'border-gray-200 text-gray-600'}`}>
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="label">Tipo de ajuste</label>
              <div className="space-y-2">
                {ADJUSTMENT_TYPES.map(t => (
                  <button key={t.value} onClick={() => set('adjustment_type', t.value)}
                    className={`w-full flex items-center justify-between p-3 rounded-lg border text-left text-sm transition-all ${form.adjustment_type === t.value ? 'border-[#ff007c] bg-[#ff007c]/5 text-[#ff007c]' : 'border-gray-200 text-gray-700'}`}>
                    <span>{t.label}</span>
                    {form.adjustment_type === t.value && <Check size={15} />}
                  </button>
                ))}
              </div>
            </div>
            {form.adjustment_type === 'tasa_fija' && (
              <div>
                <label className="label">Tasa fija (%)</label>
                <input type="number" className="input" value={form.adjustment_fixed_rate} onChange={e => set('adjustment_fixed_rate', e.target.value)} placeholder="ej: 10" />
              </div>
            )}
          </div>
        )}

        {step === 5 && (
          <div className="space-y-4">
            <div>
              <label className="label">Tipo de garantía</label>
              <div className="space-y-2">
                {GUARANTEE_TYPES.map(g => (
                  <button key={g.value} onClick={() => set('guarantee_type', g.value)}
                    className={`w-full flex items-center justify-between p-3 rounded-lg border text-left text-sm transition-all ${form.guarantee_type === g.value ? 'border-[#ff007c] bg-[#ff007c]/5 text-[#ff007c]' : 'border-gray-200 text-gray-700'}`}>
                    <span>{g.label}</span>
                    {form.guarantee_type === g.value && <Check size={15} />}
                  </button>
                ))}
              </div>
            </div>
            {form.guarantee_type === 'personal_fiador' && (
              <div>
                <label className="label">Garante</label>
                <select className="input" value={form.co_signer_id} onChange={e => set('co_signer_id', e.target.value)}>
                  <option value="">Seleccionar garante...</option>
                  {allCoSigners.map(c => <option key={c.id} value={c.id}>{c.name} {c.last_name}</option>)}
                </select>
              </div>
            )}
          </div>
        )}

        {step === 6 && (
          <div>
            <p className="text-sm text-gray-500 mb-4">Seleccioná los servicios incluidos</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { key: 'luz', label: 'Luz (electricidad)' },
                { key: 'gas', label: 'Gas' },
                { key: 'agua', label: 'Agua' },
                { key: 'expensas', label: 'Expensas' },
                { key: 'internet', label: 'Internet' },
                { key: 'abono_municipal', label: 'Abono municipal' },
              ].map(s => (
                <button key={s.key} onClick={() => toggleService(s.key)}
                  className={`flex items-center gap-2 p-3 rounded-lg border text-left text-sm transition-all ${form.services.includes(s.key) ? 'border-[#ff007c] bg-[#ff007c]/5 text-[#ff007c]' : 'border-gray-200 text-gray-700'}`}>
                  <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${form.services.includes(s.key) ? 'bg-[#ff007c] border-[#ff007c]' : 'border-gray-300'}`}>
                    {form.services.includes(s.key) && <Check size={10} color="white" />}
                  </div>
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 7 && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <button onClick={() => set('portal_active', !form.portal_active)}
                className={`w-10 h-5 rounded-full transition-all ${form.portal_active ? 'bg-[#ff007c]' : 'bg-gray-200'}`}>
                <div className={`w-4 h-4 bg-white rounded-full shadow mx-0.5 transition-all ${form.portal_active ? 'translate-x-5' : ''}`} />
              </button>
              <div>
                <div className="text-sm font-medium text-gray-900">Activar portal del inquilino</div>
                <div className="text-xs text-gray-500">El inquilino podrá consultar su contrato con un PIN</div>
              </div>
            </div>
            {form.portal_active && (
              <div>
                <label className="label">PIN (4-6 dígitos)</label>
                <input className="input" maxLength={6} value={form.portal_pin} onChange={e => set('portal_pin', e.target.value.replace(/\D/g, ''))} placeholder="1234" />
              </div>
            )}
            <div>
              <label className="label">Notas internas</label>
              <textarea className="input" rows={3} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Notas sobre el contrato..." />
            </div>
          </div>
        )}
      </div>}

      {importMode === 'manual' && error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      {importMode === 'manual' && <div className="flex gap-3 mt-4">
        {step > 0 && (
          <button onClick={() => setStep(s => s - 1)} className="btn-secondary">
            <ArrowLeft size={15} /> Anterior
          </button>
        )}
        <div className="flex-1" />
        {step < STEPS.length - 1 ? (
          <button onClick={() => validateStep() && setStep(s => s + 1)} className="btn-primary">
            Siguiente <ArrowRight size={15} />
          </button>
        ) : (
          <button onClick={submit} disabled={saving} className="btn-primary">
            {saving ? 'Creando...' : 'Crear contrato'} {!saving && <Check size={15} />}
          </button>
        )}
      </div>}
    </div>
  )
}
