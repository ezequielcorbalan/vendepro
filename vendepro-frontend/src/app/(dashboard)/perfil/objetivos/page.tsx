'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { ArrowLeft, Target, Plus, Trash2, Loader2, Save, Zap, SlidersHorizontal, DollarSign, ChevronRight } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { OBJECTIVE_METRICS, OBJECTIVE_TEMPLATES, PERIOD_TYPES, type ObjectiveMetric, type ObjectiveTemplate } from '@/lib/crm-config'
import { apiFetch } from '@/lib/api'

type Mode = null | 'method' | 'custom'

function getPeriodDates(type: string) {
  const now = new Date(Date.now() - 3 * 3600000)
  const y = now.getFullYear(), m = now.getMonth()
  if (type === 'weekly') {
    const diff = now.getDay() === 0 ? 6 : now.getDay() - 1
    const start = new Date(now); start.setDate(now.getDate() - diff)
    const end = new Date(start); end.setDate(start.getDate() + 6)
    return { start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0] }
  }
  if (type === 'monthly') return {
    start: `${y}-${String(m + 1).padStart(2, '0')}-01`,
    end: `${y}-${String(m + 1).padStart(2, '0')}-${new Date(y, m + 1, 0).getDate()}`,
  }
  if (type === 'quarterly') {
    const qm = Math.floor(m / 3) * 3
    return {
      start: `${y}-${String(qm + 1).padStart(2, '0')}-01`,
      end: `${y}-${String(qm + 3).padStart(2, '0')}-${new Date(y, qm + 3, 0).getDate()}`,
    }
  }
  return { start: `${y}-01-01`, end: `${y}-12-31` }
}

export default function MisObjetivosPage() {
  const { toast } = useToast()
  const [objectives, setObjectives] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [mode, setMode] = useState<Mode>(null)

  // Método
  const [selectedTemplate, setSelectedTemplate] = useState<ObjectiveTemplate | null>(null)
  const [ticketPromedio, setTicketPromedio] = useState<number>(0)
  const [comisionPct, setComisionPct] = useState<number>(3)

  // Personalizado
  const [metric, setMetric] = useState<string>('llamadas')
  const [periodType, setPeriodType] = useState('monthly')
  const [target, setTarget] = useState('')

  useEffect(() => {
    apiFetch('admin', '/objectives?mine=1')
      .then(r => r.json() as Promise<any>)
      .then(d => { setObjectives(Array.isArray(d) ? d : d.objectives || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const tplMetrics = selectedTemplate ? OBJECTIVE_TEMPLATES[selectedTemplate].metrics : null
  const tplPeriod = selectedTemplate ? OBJECTIVE_TEMPLATES[selectedTemplate].period : 'monthly'
  const cierresCount = tplMetrics ? (tplMetrics as any)['cierres'] || 0 : 0
  const facturacionMensual = useMemo(() => {
    if (!cierresCount || !ticketPromedio || !comisionPct) return 0
    return Math.round(cierresCount * ticketPromedio * (comisionPct / 100))
  }, [cierresCount, ticketPromedio, comisionPct])
  const facturacionAnual = facturacionMensual * 12

  function cancel() {
    setMode(null); setSelectedTemplate(null); setTicketPromedio(0); setTarget('')
  }

  async function saveMethod() {
    if (!selectedTemplate) { toast('Seleccioná un método', 'error'); return }
    const tpl = OBJECTIVE_TEMPLATES[selectedTemplate]
    const dates = getPeriodDates(tpl.period)
    const items: any[] = Object.entries(tpl.metrics).map(([m, v]) => ({
      metric: m, target: v, period_type: tpl.period,
      period_start: dates.start, period_end: dates.end,
    }))
    if (ticketPromedio > 0) items.push({ metric: 'ticket_promedio', target: ticketPromedio, period_type: tpl.period, period_start: dates.start, period_end: dates.end })
    if (facturacionMensual > 0) items.push({ metric: 'facturacion', target: facturacionMensual, period_type: tpl.period, period_start: dates.start, period_end: dates.end })

    setSaving(true)
    try {
      const res = await apiFetch('admin', '/objectives', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batch: items }),
      })
      const data = (await res.json()) as any
      if (data.created) {
        toast(`${data.created} objetivos creados`)
        const fresh = (await apiFetch('admin', '/objectives?mine=1').then(r => r.json())) as any
        setObjectives(Array.isArray(fresh) ? fresh : fresh.objectives || [])
        cancel()
      } else {
        toast(data.error || 'Error', 'error')
      }
    } catch { toast('Error', 'error') }
    setSaving(false)
  }

  async function saveCustom() {
    if (!target || parseInt(target) <= 0) { toast('Ingresá un objetivo válido', 'error'); return }
    setSaving(true)
    const dates = getPeriodDates(periodType)
    try {
      const res = await apiFetch('admin', '/objectives', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ metric, period_type: periodType, period_start: dates.start, period_end: dates.end, target: parseInt(target) }),
      })
      const data = (await res.json()) as any
      if (data.id) {
        setObjectives(prev => [...prev, { ...data, metric, period_type: periodType, period_start: dates.start, period_end: dates.end, target: parseInt(target) }])
        toast('Objetivo creado'); cancel()
      } else {
        toast(data.error || 'Error', 'error')
      }
    } catch { toast('Error', 'error') }
    setSaving(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar este objetivo?')) return
    await apiFetch('admin', `/objectives?id=${id}`, { method: 'DELETE' })
    setObjectives(prev => prev.filter(o => o.id !== id))
    toast('Objetivo eliminado')
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-8 h-8 animate-spin text-[#ff007c]" />
    </div>
  )

  return (
    <div>
      <Link href="/perfil" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 mb-4">
        <ArrowLeft className="w-4 h-4" /> Volver a mi perfil
      </Link>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-800 flex items-center gap-2">
            <Target className="w-6 h-6 text-orange-500" /> Mis objetivos
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            {objectives.length} objetivo{objectives.length !== 1 ? 's' : ''} activo{objectives.length !== 1 ? 's' : ''}
          </p>
        </div>
        {mode === null && (
          <button
            onClick={() => setMode('method')}
            className="inline-flex items-center gap-1.5 bg-[#ff007c] text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90"
          >
            <Plus className="w-4 h-4" /> Nuevo
          </button>
        )}
      </div>

      {/* Selector de modo */}
      {mode === null && objectives.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-100 p-8 text-center">
          <Target className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-600 font-medium mb-1">¿Cómo querés cargar tus objetivos?</p>
          <p className="text-sm text-gray-400 mb-6">Podés adoptar un método probado o definir los tuyos</p>
          <div className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
            <button
              onClick={() => setMode('method')}
              className="flex-1 flex items-center gap-3 px-4 py-3 bg-pink-50 border border-pink-200 rounded-xl text-left hover:border-[#ff007c] transition-colors group"
            >
              <Zap className="w-5 h-5 text-[#ff007c] shrink-0" />
              <div>
                <div className="text-sm font-semibold text-gray-800">Método probado</div>
                <div className="text-xs text-gray-400">Keller, Magnin, Agenda</div>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-300 ml-auto group-hover:text-[#ff007c]" />
            </button>
            <button
              onClick={() => setMode('custom')}
              className="flex-1 flex items-center gap-3 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-left hover:border-gray-400 transition-colors group"
            >
              <SlidersHorizontal className="w-5 h-5 text-gray-500 shrink-0" />
              <div>
                <div className="text-sm font-semibold text-gray-800">Personalizado</div>
                <div className="text-xs text-gray-400">Métrica a métrica</div>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-300 ml-auto group-hover:text-gray-500" />
            </button>
          </div>
        </div>
      )}

      {/* Formulario método */}
      {mode === 'method' && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-2"><Zap className="w-4 h-4 text-[#ff007c]" /> Elegí tu método</h2>
            <button onClick={cancel} className="text-xs text-gray-400 hover:text-gray-600">Cancelar</button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {(Object.entries(OBJECTIVE_TEMPLATES) as [ObjectiveTemplate, typeof OBJECTIVE_TEMPLATES[ObjectiveTemplate]][]).map(([key, tpl]) => (
              <button
                key={key}
                onClick={() => setSelectedTemplate(key)}
                className={`text-left px-3 py-3 rounded-xl border text-xs transition-all ${
                  selectedTemplate === key
                    ? 'border-[#ff007c] bg-pink-50 text-[#ff007c]'
                    : 'border-gray-200 bg-gray-50 text-gray-600 hover:border-gray-300'
                }`}
              >
                <div className="font-semibold text-sm">{tpl.label}</div>
                <div className="text-[10px] mt-0.5 text-gray-400 leading-tight">{tpl.description}</div>
              </button>
            ))}
          </div>

          {selectedTemplate && (
            <>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Métricas incluidas</p>
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  {Object.entries(OBJECTIVE_TEMPLATES[selectedTemplate].metrics).map(([m, v]) => (
                    <span key={m} className="text-xs text-gray-600">
                      <span className="font-medium text-gray-800">{v}</span> {(OBJECTIVE_METRICS as any)[m]?.label}
                    </span>
                  ))}
                </div>
                <p className="text-[10px] text-gray-400 mt-2">Período: {tplPeriod === 'monthly' ? 'Mensual' : tplPeriod === 'weekly' ? 'Semanal' : tplPeriod === 'quarterly' ? 'Trimestral' : 'Anual'}</p>
              </div>

              <div className="border border-orange-200 bg-orange-50 rounded-xl p-4 space-y-3">
                <p className="text-xs font-semibold text-orange-700 flex items-center gap-1.5"><DollarSign className="w-3.5 h-3.5" /> Proyección económica (opcional)</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Ticket promedio (USD)</label>
                    <input
                      type="number" min="0" step="1000"
                      value={ticketPromedio || ''}
                      onChange={e => setTicketPromedio(parseInt(e.target.value) || 0)}
                      placeholder="ej. 150.000"
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-[#ff8017] focus:border-[#ff8017]"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Comisión promedio (%)</label>
                    <input
                      type="number" min="0" max="10" step="0.1"
                      value={comisionPct || ''}
                      onChange={e => setComisionPct(parseFloat(e.target.value) || 0)}
                      placeholder="ej. 3"
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-[#ff8017] focus:border-[#ff8017]"
                    />
                  </div>
                </div>
                {facturacionMensual > 0 && (
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div className="bg-white rounded-lg p-3 text-center border border-orange-100">
                      <div className="text-[10px] text-gray-400 mb-0.5">Facturación mensual</div>
                      <div className="text-lg font-bold text-[#ff8017]">USD {facturacionMensual.toLocaleString()}</div>
                    </div>
                    <div className="bg-white rounded-lg p-3 text-center border border-orange-100">
                      <div className="text-[10px] text-gray-400 mb-0.5">Facturación anual</div>
                      <div className="text-lg font-bold text-[#ff007c]">USD {facturacionAnual.toLocaleString()}</div>
                      <div className={`text-[10px] mt-0.5 ${facturacionAnual >= 40000 ? 'text-green-600' : 'text-amber-600'}`}>
                        {facturacionAnual >= 40000 ? 'Supera el mínimo recomendado' : 'Por debajo del mínimo (USD 40.000/año)'}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          <button
            onClick={saveMethod}
            disabled={saving || !selectedTemplate}
            className="w-full bg-[#ff007c] text-white py-2.5 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Guardando...' : 'Adoptar este método'}
          </button>
        </div>
      )}

      {/* Formulario personalizado */}
      {mode === 'custom' && (
        <div className="bg-white rounded-xl border border-gray-100 p-5 mb-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-2"><SlidersHorizontal className="w-4 h-4 text-gray-500" /> Objetivo personalizado</h2>
            <button onClick={cancel} className="text-xs text-gray-400 hover:text-gray-600">Cancelar</button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Métrica</label>
              <select
                value={metric}
                onChange={e => setMetric(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
              >
                {Object.entries(OBJECTIVE_METRICS).map(([key, cfg]) => (
                  <option key={key} value={key}>{cfg.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Período</label>
              <select
                value={periodType}
                onChange={e => setPeriodType(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
              >
                {Object.entries(PERIOD_TYPES).map(([key, cfg]) => (
                  <option key={key} value={key}>{cfg.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Objetivo</label>
              <input
                type="number"
                value={target}
                onChange={e => setTarget(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                placeholder="10"
                min="1"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={saveCustom}
              disabled={saving}
              className="flex-1 bg-[#ff007c] text-white py-2 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Crear
            </button>
            <button onClick={cancel} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">Cancelar</button>
          </div>
          <button
            onClick={() => setMode('method')}
            className="text-xs text-[#ff007c] hover:underline flex items-center gap-1"
          >
            <Zap className="w-3 h-3" /> Prefiero adoptar un método
          </button>
        </div>
      )}

      {/* Lista de objetivos */}
      {objectives.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 divide-y divide-gray-100">
          {objectives.map(obj => {
            const metricCfg = (OBJECTIVE_METRICS as any)[obj.metric]
            const periodCfg = (PERIOD_TYPES as any)[obj.period_type]
            return (
              <div key={obj.id} className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-800">{metricCfg?.label || obj.metric}</p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{periodCfg?.label || obj.period_type}</span>
                    <span className="text-xs text-gray-400">Objetivo: <strong className="text-gray-700">{obj.target}</strong></span>
                    <span className="text-xs text-gray-400">{obj.period_start} → {obj.period_end}</span>
                  </div>
                </div>
                <button onClick={() => handleDelete(obj.id)} className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Botones modo si ya hay objetivos */}
      {mode === null && objectives.length > 0 && (
        <div className="mt-4 flex gap-2">
          <button
            onClick={() => setMode('method')}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-[#ff007c] border border-gray-200 px-3 py-1.5 rounded-lg hover:border-[#ff007c] transition-colors"
          >
            <Zap className="w-3.5 h-3.5" /> Adoptar un método
          </button>
          <button
            onClick={() => setMode('custom')}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 border border-gray-200 px-3 py-1.5 rounded-lg hover:border-gray-400 transition-colors"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" /> Agregar personalizado
          </button>
        </div>
      )}
    </div>
  )
}
