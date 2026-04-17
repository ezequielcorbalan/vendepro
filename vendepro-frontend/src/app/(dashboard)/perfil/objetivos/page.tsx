'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft, Target, Plus, Trash2, Loader2, Save } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { OBJECTIVE_METRICS, PERIOD_TYPES, type ObjectiveMetric } from '@/lib/crm-config'
import { apiFetch } from '@/lib/api'

export default function MisObjetivosPage() {
  const { toast } = useToast()
  const [objectives, setObjectives] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [showForm, setShowForm] = useState(false)
  const [metric, setMetric] = useState<string>('llamadas')
  const [periodType, setPeriodType] = useState('monthly')
  const [target, setTarget] = useState('')

  useEffect(() => {
    apiFetch('admin', '/objectives?mine=1')
      .then(r => r.json() as Promise<any>)
      .then(d => { setObjectives(Array.isArray(d) ? d : d.objectives || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  function getPeriodDates(type: string) {
    const now = new Date(Date.now() - 3 * 3600000) // Argentina UTC-3
    const y = now.getFullYear(), m = now.getMonth()
    if (type === 'weekly') {
      const day = now.getDay()
      const diff = day === 0 ? 6 : day - 1
      const start = new Date(now); start.setDate(now.getDate() - diff)
      const end = new Date(start); end.setDate(start.getDate() + 6)
      return { start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0] }
    }
    if (type === 'monthly') {
      return {
        start: `${y}-${String(m + 1).padStart(2, '0')}-01`,
        end: `${y}-${String(m + 1).padStart(2, '0')}-${new Date(y, m + 1, 0).getDate()}`
      }
    }
    if (type === 'quarterly') {
      const qm = Math.floor(m / 3) * 3
      return {
        start: `${y}-${String(qm + 1).padStart(2, '0')}-01`,
        end: `${y}-${String(qm + 3).padStart(2, '0')}-${new Date(y, qm + 3, 0).getDate()}`
      }
    }
    return { start: `${y}-01-01`, end: `${y}-12-31` }
  }

  const handleCreate = async () => {
    if (!target || parseInt(target) <= 0) { toast('Ingresá un objetivo válido', 'error'); return }
    setSaving(true)
    const dates = getPeriodDates(periodType)
    try {
      const res = await apiFetch('admin', '/objectives', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          metric, period_type: periodType,
          period_start: dates.start, period_end: dates.end,
          target: parseInt(target),
        }),
      })
      const data = (await res.json()) as any
      if (data.id) {
        setObjectives(prev => [...prev, {
          ...data, metric, period_type: periodType,
          period_start: dates.start, period_end: dates.end, target: parseInt(target)
        }])
        toast('Objetivo creado')
        setShowForm(false); setTarget('')
      } else {
        toast(data.error || 'Error', 'error')
      }
    } catch { toast('Error', 'error') }
    setSaving(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este objetivo?')) return
    await apiFetch('admin', `/objectives?id=${id}`, { method: 'DELETE' })
    setObjectives(prev => prev.filter(o => o.id !== id))
    toast('Objetivo eliminado')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-[#ff007c]" />
      </div>
    )
  }

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
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-1.5 bg-[#ff007c] text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90"
        >
          <Plus className="w-4 h-4" /> Nuevo
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-gray-100 p-5 mb-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-800">Nuevo objetivo</h2>
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
              onClick={handleCreate}
              disabled={saving}
              className="flex-1 bg-[#ff007c] text-white py-2 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Crear
            </button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Objectives list */}
      {objectives.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
          <Target className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 mb-2">Sin objetivos cargados</p>
          <button onClick={() => setShowForm(true)} className="text-sm text-[#ff007c] font-medium hover:underline">
            Crear mi primer objetivo
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 divide-y divide-gray-100">
          {objectives.map(obj => {
            const metricCfg = (OBJECTIVE_METRICS as any)[obj.metric]
            const periodCfg = (PERIOD_TYPES as any)[obj.period_type]
            return (
              <div key={obj.id} className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-800">{metricCfg?.label || obj.metric}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                      {periodCfg?.label || obj.period_type}
                    </span>
                    <span className="text-xs text-gray-400">
                      Objetivo: <strong className="text-gray-700">{obj.target}</strong>
                    </span>
                    <span className="text-xs text-gray-400">{obj.period_start} → {obj.period_end}</span>
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(obj.id)}
                  className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
