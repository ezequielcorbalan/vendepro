'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { Target, Plus, Trash2, Save, Users, ChevronDown, ChevronUp, Loader2, Zap, DollarSign, ArrowLeft } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Heading } from '@/components/ui/Typography'
import { Button } from '@/components/ui/Button'
import { PillCheckGroup } from '@/components/ui/ChoicePills'
import { Field, Input } from '@/components/ui/Input'
import { Alert } from '@/components/ui/Alert'
import { EmptyState } from '@/components/ui/EmptyState'
import { OBJECTIVE_METRICS, OBJECTIVE_TEMPLATES, scaleMetrics, type ObjectiveMetric, type ObjectiveTemplate } from '@/lib/crm-config'
import { apiFetch } from '@/lib/api'

const METRIC_KEYS = Object.keys(OBJECTIVE_METRICS) as ObjectiveMetric[]
const CATEGORIES = {
  actividad: {
    label: 'Actividad / Prospección',
    metrics: METRIC_KEYS.filter(k => OBJECTIVE_METRICS[k].category === 'actividad'),
  },
  resultado: {
    label: 'Resultados',
    metrics: METRIC_KEYS.filter(k => OBJECTIVE_METRICS[k].category === 'resultado'),
  },
}

const PERIOD_PRESETS = {
  weekly: {
    label: 'Semanal',
    getRange: () => {
      const d = new Date(); const s = new Date(d)
      s.setDate(d.getDate() - d.getDay() + 1)
      const e = new Date(s); e.setDate(s.getDate() + 6)
      return { start: fmt(s), end: fmt(e) }
    }
  },
  monthly: {
    label: 'Mensual',
    getRange: () => {
      const d = new Date()
      return {
        start: `${d.getFullYear()}-${p(d.getMonth() + 1)}-01`,
        end: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()}`
      }
    }
  },
  quarterly: {
    label: 'Trimestral',
    getRange: () => {
      const d = new Date(); const qm = Math.floor(d.getMonth() / 3) * 3
      return {
        start: `${d.getFullYear()}-${p(qm + 1)}-01`,
        end: `${d.getFullYear()}-${p(qm + 3)}-${new Date(d.getFullYear(), qm + 3, 0).getDate()}`
      }
    }
  },
  yearly: {
    label: 'Anual',
    getRange: () => { const y = new Date().getFullYear(); return { start: `${y}-01-01`, end: `${y}-12-31` } }
  },
}
function p(n: number) { return String(n).padStart(2, '0') }
function fmt(d: Date) { return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}` }

type Agent = { id: string; full_name: string }
type Objective = { id: string; agent_id: string; agent_name: string; metric: string; target: number; period_type: string; period_start: string; period_end: string }

function AgentCard({ agent, objectives, onDelete }: { agent: Agent; objectives: Objective[]; onDelete: (id: string) => void }) {
  const [open, setOpen] = useState(true)
  return (
    <Card padded={false} className="overflow-hidden">
      <Button variant="ghost" size="icon" onClick={() => setOpen(!open)} className="w-full flex items-center justify-between p-4 hover:bg-gray-50">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-gray-400" />
          <span className="font-medium text-ink">{agent.full_name}</span>
          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{objectives.length}</span>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </Button>
      {open && (
        <div className="border-t border-gray-100 divide-y divide-gray-50">
          {objectives.map(obj => {
            const cfg = OBJECTIVE_METRICS[obj.metric as ObjectiveMetric]
            return (
              <div key={obj.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 group">
                <span className="text-sm text-gray-700 flex-1 truncate">{cfg?.label || obj.metric}</span>
                <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{obj.period_type}</span>
                <span className="text-sm font-bold text-ink w-12 text-right">{obj.target}</span>
                <span className="text-[10px] text-gray-400 w-20 text-right hidden sm:block">{obj.period_start?.slice(5)}</span>
                <Button variant="ghost" size="icon"
                  onClick={() => onDelete(obj.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 text-gray-300 hover:text-red-500 transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}

export default function ObjetivosConfigPage() {
  const { toast } = useToast()
  const [agents, setAgents] = useState<Agent[]>([])
  const [objectives, setObjectives] = useState<Objective[]>([])
  const [loading, setLoading] = useState(true)
  const [showBatch, setShowBatch] = useState(false)
  const [batchAgents, setBatchAgents] = useState<string[]>([])
  const [batchPeriod, setBatchPeriod] = useState<'weekly' | 'monthly' | 'quarterly' | 'yearly'>('monthly')
  const [batchTargets, setBatchTargets] = useState<Record<string, number>>({})
  const [selectedTemplate, setSelectedTemplate] = useState<ObjectiveTemplate | null>(null)
  const [ticketPromedio, setTicketPromedio] = useState<number>(0)
  const [comisionPct, setComisionPct] = useState<number>(3)
  const [saving, setSaving] = useState(false)

  async function loadAll() {
    try {
      const [ar, or_] = await Promise.all([
        apiFetch('admin', '/agents').then(r => r.json() as Promise<any>),
        apiFetch('admin', '/objectives').then(r => r.json() as Promise<any>),
      ])
      if (Array.isArray(ar)) setAgents(ar)
      if (Array.isArray(or_)) setObjectives(or_)
    } catch {}
    setLoading(false)
  }

  useEffect(() => { loadAll() }, [])

  const periodRange = PERIOD_PRESETS[batchPeriod].getRange()

  function applyTemplate(key: ObjectiveTemplate, period?: string) {
    const tpl = OBJECTIVE_TEMPLATES[key]
    const targetPeriod = period ?? batchPeriod
    setSelectedTemplate(key)
    const scaled = scaleMetrics(tpl.metrics as Record<string, number>, targetPeriod)
    setBatchTargets(prev => ({ ...prev, ...scaled }))
  }

  function handlePeriodChange(period: 'weekly' | 'monthly' | 'quarterly' | 'yearly') {
    setBatchPeriod(period)
    if (selectedTemplate) applyTemplate(selectedTemplate, period)
  }

  const facturacionMensual = useMemo(() => {
    const cierres = batchTargets['cierres'] || 0
    if (!cierres || !ticketPromedio || !comisionPct) return 0
    return Math.round(cierres * ticketPromedio * (comisionPct / 100))
  }, [batchTargets, ticketPromedio, comisionPct])

  const facturacionAnual = useMemo(() => facturacionMensual * 12, [facturacionMensual])

  const byAgent = useMemo(() => {
    const map: Record<string, Objective[]> = {}
    for (const o of objectives) {
      if (!map[o.agent_id]) map[o.agent_id] = []
      map[o.agent_id].push(o)
    }
    return map
  }, [objectives])

  async function saveBatch() {
    if (batchAgents.length === 0) { toast('Seleccioná al menos un agente', 'error'); return }
    const allTargets = { ...batchTargets }
    if (ticketPromedio > 0) allTargets['ticket_promedio'] = ticketPromedio
    if (facturacionMensual > 0) allTargets['facturacion'] = facturacionMensual
    const items = batchAgents.flatMap(agentId =>
      Object.entries(allTargets)
        .filter(([, target]) => target > 0)
        .map(([metric, target]) => ({
          agent_id: agentId, metric, target,
          period_type: batchPeriod,
          period_start: periodRange.start,
          period_end: periodRange.end,
        }))
    )
    if (items.length === 0) { toast('Cargá al menos un objetivo con valor > 0', 'error'); return }

    setSaving(true)
    try {
      const res = await apiFetch('admin', '/objectives', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batch: items }),
      })
      const data = (await res.json()) as any
      if (data.created) {
        toast(`${data.created} objetivos creados para ${batchAgents.length} agente${batchAgents.length > 1 ? 's' : ''}`)
        const fresh = (await apiFetch('admin', '/objectives').then(r => r.json())) as any
        if (Array.isArray(fresh)) setObjectives(fresh)
        setShowBatch(false); setBatchTargets({}); setBatchAgents([]); setSelectedTemplate(null); setTicketPromedio(0)
      } else {
        toast(data.error || 'Error', 'error')
      }
    } catch { toast('Error al guardar', 'error') }
    setSaving(false)
  }

  async function deleteObj(id: string) {
    if (!confirm('¿Eliminar este objetivo?')) return
    await apiFetch('admin', `/objectives?id=${id}`, { method: 'DELETE' })
    setObjectives(prev => prev.filter(o => o.id !== id))
    toast('Objetivo eliminado')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Link
        href="/configuracion"
        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-ink"
      >
        <ArrowLeft className="w-4 h-4" /> Volver a Configuración
      </Link>
      <PageHeader
        title="Objetivos por agente"
        subtitle={`${objectives.length} objetivos activos`}
        actions={
          <Button onClick={() => setShowBatch(!showBatch)} icon={<Plus className="w-4 h-4" />}>
            Crear en batch
          </Button>
        }
      />

      {showBatch && (
        <Card className="p-4 sm:p-6 space-y-4">
          <Heading level={4} as="h2">Crear objetivos en batch</Heading>

          {/* Plantillas de método */}
          <div>
            <label className="text-xs text-gray-500 mb-1.5 flex items-center gap-1"><Zap className="w-3 h-3" /> Método base (opcional)</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {(Object.entries(OBJECTIVE_TEMPLATES) as [ObjectiveTemplate, typeof OBJECTIVE_TEMPLATES[ObjectiveTemplate]][]).map(([key, tpl]) => (
                <Button variant="ghost" size="icon"
                  key={key}
                  onClick={() => applyTemplate(key)}
                  className={`text-left px-3 py-2.5 rounded-control border text-xs transition-all ${
                    selectedTemplate === key
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-gray-200 bg-gray-50 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  <div className="font-semibold">{tpl.label}</div>
                  <div className="text-[10px] mt-0.5 text-gray-400 leading-tight">{tpl.description}</div>
                </Button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-500 mb-1.5 block">Período</label>
            <div className="flex gap-1 bg-gray-100 rounded-control p-0.5 w-fit">
              {(Object.entries(PERIOD_PRESETS) as [string, any][]).map(([k, v]) => (
                <Button variant="ghost" size="icon"
                  key={k}
                  onClick={() => handlePeriodChange(k as any)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${batchPeriod === k ? 'bg-white shadow text-ink' : 'text-gray-500'}`}
                >
                  {v.label}
                </Button>
              ))}
            </div>
            <p className="text-[10px] text-gray-400 mt-1">{periodRange.start} → {periodRange.end}</p>
          </div>

          <div>
            {/* Una fila de chips de selección múltiple ES PillCheckGroup. El
                activo del DS es fondo claro con stroke primary, no relleno
                sólido — el mismo criterio que se aplicó al resto de los chips. */}
            <label className="text-xs text-gray-500 mb-1.5 block">Agentes</label>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant={batchAgents.length === agents.length ? 'primary' : 'outline'}
                size="sm"
                className="rounded-full"
                onClick={() => setBatchAgents(batchAgents.length === agents.length ? [] : agents.map(a => a.id))}
              >
                Todos
              </Button>
              {/* Sin `label`: el prop se dibuja VISIBLE además de nombrar al
                  grupo, y acá la etiqueta ya está arriba. ds-todo: candidato a
                  que PillCheckGroup acepte aria-labelledby. */}
              <PillCheckGroup
                size="sm"
                options={agents.map(a => ({ value: a.id, label: a.full_name }))}
                value={batchAgents}
                onChange={setBatchAgents}
              />
            </div>
          </div>

          {Object.entries(CATEGORIES).map(([catKey, cat]) => (
            <div key={catKey}>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">{cat.label}</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                {cat.metrics.map(metric => (
                  <div key={metric} className="flex items-center gap-2 bg-gray-50 rounded-control px-3 py-2">
                    <label className="text-xs text-gray-600 flex-1 truncate">{OBJECTIVE_METRICS[metric].label}</label>
                    <Input
                      type="number"
                      min="0"
                      step="1"
                      value={batchTargets[metric] || ''}
                      onChange={e => setBatchTargets(prev => ({ ...prev, [metric]: parseInt(e.target.value) || 0 }))}
                      placeholder="0"
                      className="w-16 text-right px-2 py-1"
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Proyección económica — highlight con el token de marca (no es un alert, es un panel de resultados) */}
          <div className="border border-brand-orange/20 bg-brand-orange/5 rounded-card p-4 space-y-3">
            <p className="text-xs font-semibold text-brand-orange flex items-center gap-1.5"><DollarSign className="w-3.5 h-3.5" /> Proyección económica</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Ticket promedio (USD)">
                <Input
                  type="number" min="0" step="1000"
                  value={ticketPromedio || ''}
                  onChange={e => setTicketPromedio(parseInt(e.target.value) || 0)}
                  placeholder="ej. 150000"
                />
              </Field>
              <Field label="Comisión promedio (%)">
                <Input
                  type="number" min="0" max="10" step="0.1"
                  value={comisionPct || ''}
                  onChange={e => setComisionPct(parseFloat(e.target.value) || 0)}
                  placeholder="ej. 3"
                />
              </Field>
            </div>
            {facturacionMensual > 0 && (
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="bg-white rounded-control p-3 text-center border border-brand-orange/10">
                  <div className="text-[10px] text-gray-400 mb-0.5">Facturación mensual</div>
                  <div className="text-lg font-bold text-brand-orange">USD {facturacionMensual.toLocaleString()}</div>
                </div>
                <div className="bg-white rounded-control p-3 text-center border border-brand-orange/10">
                  <div className="text-[10px] text-gray-400 mb-0.5">Facturación anual</div>
                  <div className="text-lg font-bold text-primary">USD {facturacionAnual.toLocaleString()}</div>
                  {facturacionAnual < 40000 && (
                    <div className="text-[10px] text-warning mt-0.5">Por debajo del mínimo recomendado (USD 40.000/año)</div>
                  )}
                  {facturacionAnual >= 40000 && (
                    <div className="text-[10px] text-success mt-0.5">Supera el mínimo recomendado</div>
                  )}
                </div>
              </div>
            )}
            {ticketPromedio > 0 && comisionPct > 0 && !batchTargets['cierres'] && (
              <p className="text-[10px] text-brand-orange">Cargá el objetivo de cierres/ventas para calcular la proyección.</p>
            )}
          </div>

          {batchAgents.length > 0 && Object.values(batchTargets).some(v => v > 0) && (
            <Alert tone="info">
              Se crearán <strong>{batchAgents.length * (Object.values(batchTargets).filter(v => v > 0).length + (ticketPromedio > 0 ? 1 : 0) + (facturacionMensual > 0 ? 1 : 0))}</strong> objetivos
              ({Object.values(batchTargets).filter(v => v > 0).length} métricas{ticketPromedio > 0 ? ' + ticket' : ''}{facturacionMensual > 0 ? ' + facturación' : ''} × {batchAgents.length} agente{batchAgents.length > 1 ? 's' : ''})
            </Alert>
          )}

          <div className="flex gap-2">
            <Button onClick={saveBatch} loading={saving} icon={<Save className="w-4 h-4" />}>
              {saving ? 'Guardando...' : 'Guardar objetivos'}
            </Button>
            <Button variant="ghost" onClick={() => { setShowBatch(false); setSelectedTemplate(null); setTicketPromedio(0); setBatchTargets({}); setBatchAgents([]) }}>
              Cancelar
            </Button>
          </div>
        </Card>
      )}

      {agents.map(agent => {
        const agentObjs = byAgent[agent.id]
        if (!agentObjs || agentObjs.length === 0) return null
        return <AgentCard key={agent.id} agent={agent} objectives={agentObjs} onDelete={deleteObj} />
      })}

      {objectives.length === 0 && !showBatch && (
        <Card>
          <EmptyState
            icon={<Target className="w-6 h-6" />}
            title="Sin objetivos cargados"
            description={'Usá "Crear en batch" para cargar objetivos para tus agentes'}
          />
        </Card>
      )}
    </div>
  )
}
