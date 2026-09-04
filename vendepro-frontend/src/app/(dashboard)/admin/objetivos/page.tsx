'use client'

import { useState, useEffect } from 'react'
import { Target, Plus, Trash2, Loader2 } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Heading } from '@/components/ui/Typography'
import { Field, Input, Select } from '@/components/ui/Input'
import { EmptyState } from '@/components/ui/EmptyState'
import {
  OBJECTIVE_METRICS, getObjectiveSemaforo, getPeriodProgressPct,
  type ObjectiveMetric
} from '@/lib/crm-config'

export default function ObjetivosPage() {
  const { toast } = useToast()
  const [objectives, setObjectives] = useState<any[]>([])
  const [agents, setAgents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filterAgent, setFilterAgent] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    agent_id: '',
    metric: 'llamadas' as ObjectiveMetric,
    target: '',
    period_type: 'monthly',
    period_start: new Date().toISOString().split('T')[0],
    period_end: (() => { const d = new Date(); d.setMonth(d.getMonth() + 1); return d.toISOString().split('T')[0] })(),
  })

  function loadData() {
    const params = filterAgent ? `?agent_id=${filterAgent}` : ''
    Promise.all([
      apiFetch('admin', `/objectives${params}`).then(r => r.json() as Promise<any>),
      apiFetch('admin', '/agents').then(r => r.json() as Promise<any>),
    ]).then(([objs, agts]) => {
      setObjectives(Array.isArray(objs) ? objs : [])
      setAgents(Array.isArray(agts) ? agts : [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }

  useEffect(() => { loadData() }, [filterAgent])

  async function handleCreate() {
    if (!form.agent_id || !form.target) return
    setSaving(true)
    try {
      const res = await apiFetch('admin', '/objectives', {
        method: 'POST',
        body: JSON.stringify({ ...form, target: Number(form.target) }),
      })
      const data = (await res.json()) as any
      if (data.id || data.success) {
        toast('Objetivo creado')
        setShowCreate(false)
        loadData()
      } else {
        toast(data.error || 'Error al crear', 'error')
      }
    } catch { toast('Error de conexión', 'error') }
    setSaving(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar este objetivo?')) return
    await apiFetch('admin', `/objectives?id=${id}`, { method: 'DELETE' })
    toast('Objetivo eliminado', 'warning')
    loadData()
  }

  const objectivesWithProgress = objectives.map(obj => {
    const metricCfg = OBJECTIVE_METRICS[obj.metric as ObjectiveMetric]
    const periodPct = getPeriodProgressPct(obj.period_start, obj.period_end)
    const semaforo = getObjectiveSemaforo(obj.realized || 0, obj.target, periodPct)
    return { ...obj, semaforo, metricLabel: metricCfg?.label || obj.metric }
  })

  return (
    <div className="space-y-5">
      <PageHeader
        title="Objetivos"
        subtitle={`${objectives.length} objetivo${objectives.length !== 1 ? 's' : ''}`}
        actions={
          <Button icon={<Plus className="w-4 h-4" />} onClick={() => setShowCreate(true)}>
            Nuevo objetivo
          </Button>
        }
      />

      {agents.length > 0 && (
        <Select value={filterAgent} onChange={e => setFilterAgent(e.target.value)} className="sm:w-auto">
          <option value="">Todos los agentes</option>
          {agents.map(a => <option key={a.id} value={a.id}>{a.full_name}</option>)}
        </Select>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
      ) : objectives.length === 0 ? (
        <EmptyState icon={<Target className="w-6 h-6" />} title="Sin objetivos definidos" />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {objectivesWithProgress.map(obj => (
            <Card key={obj.id}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <Heading level={4}>{obj.metricLabel}</Heading>
                  {obj.agent_name && <p className="text-xs text-gray-400 mt-0.5">{obj.agent_name}</p>}
                </div>
                <div className="flex items-center gap-1">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${obj.semaforo.color}`}>{obj.semaforo.label}</span>
                  <button onClick={() => handleDelete(obj.id)} className="p-1 text-gray-300 hover:text-red-500">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <div className="flex items-end justify-between mb-2">
                <p className="text-3xl font-bold text-ink">{obj.realized || 0}</p>
                <p className="text-sm text-gray-400">/{obj.target}</p>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-pink-500 to-orange-400 rounded-full transition-all"
                  style={{ width: `${Math.min(Math.round(((obj.realized || 0) / obj.target) * 100), 100)}%` }}
                />
              </div>
              <div className="flex items-center justify-between mt-2 text-[10px] text-gray-400">
                <span>{new Date(obj.period_start).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}</span>
                <span>{new Date(obj.period_end).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}</span>
              </div>
            </Card>
          ))}
        </div>
      )}

      {showCreate && (
        <Modal
          open
          sheet
          onClose={() => setShowCreate(false)}
          title="Nuevo objetivo"
          icon={<Target className="w-5 h-5" />}
          footer={
            <>
              <Button variant="outline" onClick={() => setShowCreate(false)}>Cancelar</Button>
              <Button onClick={handleCreate} loading={saving} disabled={!form.agent_id || !form.target}>
                Crear objetivo
              </Button>
            </>
          }
        >
            <div className="space-y-3">
              <Select value={form.agent_id} onChange={e => setForm(f => ({ ...f, agent_id: e.target.value }))}>
                <option value="">Seleccionar agente *</option>
                {agents.map(a => <option key={a.id} value={a.id}>{a.full_name}</option>)}
              </Select>
              <Select value={form.metric} onChange={e => setForm(f => ({ ...f, metric: e.target.value as ObjectiveMetric }))}>
                {Object.entries(OBJECTIVE_METRICS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </Select>
              <Input type="number" placeholder="Target (número) *" value={form.target} onChange={e => setForm(f => ({ ...f, target: e.target.value }))} />
              <div className="grid grid-cols-2 gap-3">
                <Field label="Inicio" htmlFor="period_start">
                  <Input id="period_start" type="date" value={form.period_start} onChange={e => setForm(f => ({ ...f, period_start: e.target.value }))} />
                </Field>
                <Field label="Fin" htmlFor="period_end">
                  <Input id="period_end" type="date" value={form.period_end} onChange={e => setForm(f => ({ ...f, period_end: e.target.value }))} />
                </Field>
              </div>
            </div>
        </Modal>
      )}
    </div>
  )
}
