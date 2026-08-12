'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { ArrowLeft, Target, Plus, Trash2, Loader2, Save, Zap, SlidersHorizontal, DollarSign, ChevronRight } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select } from '@/components/ui/Input'
import { EmptyState } from '@/components/ui/EmptyState'
import { Text } from '@/components/ui/Typography'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { OBJECTIVE_METRICS, OBJECTIVE_TEMPLATES, PERIOD_TYPES, scaleMetrics, type ObjectiveTemplate } from '@/lib/crm-config'
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
  const [methodPeriod, setMethodPeriod] = useState<string>('monthly')
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

  const tplMetrics = selectedTemplate
    ? scaleMetrics(OBJECTIVE_TEMPLATES[selectedTemplate].metrics as Record<string, number>, methodPeriod)
    : null
  const cierresCount = tplMetrics ? tplMetrics['cierres'] || 0 : 0
  const facturacionMensual = useMemo(() => {
    if (!cierresCount || !ticketPromedio || !comisionPct) return 0
    return Math.round(cierresCount * ticketPromedio * (comisionPct / 100))
  }, [cierresCount, ticketPromedio, comisionPct])
  const facturacionAnual = facturacionMensual * 12

  function cancel() {
    setMode(null); setSelectedTemplate(null); setTicketPromedio(0); setTarget(''); setMethodPeriod('monthly')
  }

  async function saveMethod() {
    if (!selectedTemplate) { toast('Seleccioná un método', 'error'); return }
    const scaled = scaleMetrics(OBJECTIVE_TEMPLATES[selectedTemplate].metrics as Record<string, number>, methodPeriod)
    const dates = getPeriodDates(methodPeriod)
    const items: any[] = Object.entries(scaled).map(([m, v]) => ({
      metric: m, target: v, period_type: methodPeriod,
      period_start: dates.start, period_end: dates.end,
    }))
    if (ticketPromedio > 0) items.push({ metric: 'ticket_promedio', target: ticketPromedio, period_type: methodPeriod, period_start: dates.start, period_end: dates.end })
    if (facturacionMensual > 0) items.push({ metric: 'facturacion', target: facturacionMensual, period_type: methodPeriod, period_start: dates.start, period_end: dates.end })

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
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  )

  return (
    <div>
      <Link href="/perfil" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-ink mb-4">
        <ArrowLeft className="w-4 h-4" /> Volver a mi perfil
      </Link>

      <PageHeader
        title="Mis objetivos"
        subtitle={`${objectives.length} objetivo${objectives.length !== 1 ? 's' : ''} activo${objectives.length !== 1 ? 's' : ''}`}
        actions={mode === null ? (
          <Button icon={<Plus className="w-4 h-4" />} onClick={() => setMode('method')}>
            Nuevo
          </Button>
        ) : undefined}
        className="mb-6"
      />

      {/* Selector de modo */}
      {mode === null && objectives.length === 0 && (
        <Card padded={false}>
          <EmptyState
            icon={<Target className="w-6 h-6" />}
            title="¿Cómo querés cargar tus objetivos?"
            description="Podés adoptar un método probado o definir los tuyos"
            action={
              <div className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
                {/* ds-todo: candidato a componente "OptionCard" (tarjeta seleccionable con ícono + título + descripción) */}
                <button
                  onClick={() => setMode('method')}
                  className="flex-1 flex items-center gap-3 px-4 py-3 bg-primary/5 border border-primary/30 rounded-card text-left hover:border-primary transition-colors group"
                >
                  <Zap className="w-5 h-5 text-primary shrink-0" />
                  <div>
                    <div className="text-sm font-semibold text-ink">Método probado</div>
                    <div className="text-xs text-gray-400">Keller, Magnin, Agenda</div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300 ml-auto group-hover:text-primary" />
                </button>
                <button
                  onClick={() => setMode('custom')}
                  className="flex-1 flex items-center gap-3 px-4 py-3 bg-gray-50 border border-gray-200 rounded-card text-left hover:border-gray-400 transition-colors group"
                >
                  <SlidersHorizontal className="w-5 h-5 text-gray-500 shrink-0" />
                  <div>
                    <div className="text-sm font-semibold text-ink">Personalizado</div>
                    <div className="text-xs text-gray-400">Métrica a métrica</div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300 ml-auto group-hover:text-gray-500" />
                </button>
              </div>
            }
          />
        </Card>
      )}

      {/* Formulario método */}
      {mode === 'method' && (
        <Card className="mb-6 space-y-5">
          <CardHeader className="mb-0">
            <CardTitle className="flex items-center gap-2"><Zap className="w-4 h-4 text-primary" /> Elegí tu método</CardTitle>
            <Button variant="ghost" onClick={cancel}>Cancelar</Button>
          </CardHeader>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {/* ds-todo: candidato a componente "OptionCard" (tarjeta seleccionable de template) */}
            {(Object.entries(OBJECTIVE_TEMPLATES) as [ObjectiveTemplate, typeof OBJECTIVE_TEMPLATES[ObjectiveTemplate]][]).map(([key, tpl]) => (
              <button
                key={key}
                onClick={() => setSelectedTemplate(key)}
                className={`text-left px-3 py-3 rounded-card border text-xs transition-all ${
                  selectedTemplate === key
                    ? 'border-primary bg-primary/5 text-primary'
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
              <div>
                <label className="text-xs text-gray-500 mb-1.5 block">Período</label>
                <SegmentedControl
                  options={Object.entries(PERIOD_TYPES).map(([k, v]) => ({ value: k, label: v.label }))}
                  value={methodPeriod}
                  onChange={setMethodPeriod}
                />
              </div>

              <div className="bg-gray-50 rounded-control p-3">
                <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Métricas incluidas ({PERIOD_TYPES[methodPeriod as keyof typeof PERIOD_TYPES]?.label})</p>
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  {tplMetrics && Object.entries(tplMetrics).map(([m, v]) => (
                    <span key={m} className="text-xs text-gray-600">
                      <span className="font-medium text-ink">{v}</span> {(OBJECTIVE_METRICS as any)[m]?.label}
                    </span>
                  ))}
                </div>
              </div>

              <div className="border border-brand-orange/30 bg-brand-orange/5 rounded-card p-4 space-y-3">
                <p className="text-xs font-semibold text-brand-orange flex items-center gap-1.5"><DollarSign className="w-3.5 h-3.5" /> Proyección económica (opcional)</p>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Ticket promedio (USD)">
                    <Input
                      type="number" min="0" step="1000"
                      value={ticketPromedio || ''}
                      onChange={e => setTicketPromedio(parseInt(e.target.value) || 0)}
                      placeholder="ej. 150.000"
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
                    <div className="bg-white rounded-control p-3 text-center border border-brand-orange/20">
                      <div className="text-[10px] text-gray-400 mb-0.5">Facturación mensual</div>
                      <div className="text-lg font-bold text-brand-orange">USD {facturacionMensual.toLocaleString()}</div>
                    </div>
                    <div className="bg-white rounded-control p-3 text-center border border-brand-orange/20">
                      <div className="text-[10px] text-gray-400 mb-0.5">Facturación anual</div>
                      <div className="text-lg font-bold text-primary">USD {facturacionAnual.toLocaleString()}</div>
                      <div className={`text-[10px] mt-0.5 ${facturacionAnual >= 40000 ? 'text-success' : 'text-warning'}`}>
                        {facturacionAnual >= 40000 ? 'Supera el mínimo recomendado' : 'Por debajo del mínimo (USD 40.000/año)'}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          <Button
            fullWidth
            size="lg"
            loading={saving}
            disabled={!selectedTemplate}
            icon={<Save className="w-4 h-4" />}
            onClick={saveMethod}
          >
            {saving ? 'Guardando...' : 'Adoptar este método'}
          </Button>
        </Card>
      )}

      {/* Formulario personalizado */}
      {mode === 'custom' && (
        <Card className="mb-6 space-y-4">
          <CardHeader className="mb-0">
            <CardTitle className="flex items-center gap-2"><SlidersHorizontal className="w-4 h-4 text-gray-500" /> Objetivo personalizado</CardTitle>
            <Button variant="ghost" onClick={cancel}>Cancelar</Button>
          </CardHeader>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label="Métrica">
              <Select value={metric} onChange={e => setMetric(e.target.value)}>
                {Object.entries(OBJECTIVE_METRICS).map(([key, cfg]) => (
                  <option key={key} value={key}>{cfg.label}</option>
                ))}
              </Select>
            </Field>
            <Field label="Período">
              <Select value={periodType} onChange={e => setPeriodType(e.target.value)}>
                {Object.entries(PERIOD_TYPES).map(([key, cfg]) => (
                  <option key={key} value={key}>{cfg.label}</option>
                ))}
              </Select>
            </Field>
            <Field label="Objetivo">
              <Input
                type="number"
                value={target}
                onChange={e => setTarget(e.target.value)}
                placeholder="10"
                min="1"
              />
            </Field>
          </div>
          <div className="flex gap-2">
            <Button
              className="flex-1"
              loading={saving}
              icon={<Save className="w-4 h-4" />}
              onClick={saveCustom}
            >
              Crear
            </Button>
            <Button variant="ghost" onClick={cancel}>Cancelar</Button>
          </div>
          <button
            onClick={() => setMode('method')}
            className="text-xs text-primary hover:underline flex items-center gap-1"
          >
            <Zap className="w-3 h-3" /> Prefiero adoptar un método
          </button>
        </Card>
      )}

      {/* Lista de objetivos */}
      {objectives.length > 0 && (
        <Card padded={false} className="divide-y divide-gray-100">
          {objectives.map(obj => {
            const metricCfg = (OBJECTIVE_METRICS as any)[obj.metric]
            const periodCfg = (PERIOD_TYPES as any)[obj.period_type]
            return (
              <div key={obj.id} className="p-4 flex items-center justify-between">
                <div>
                  <Text weight="medium">{metricCfg?.label || obj.metric}</Text>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{periodCfg?.label || obj.period_type}</span>
                    <Text as="span" size="xs" tone="muted">Objetivo: <strong className="text-gray-700">{obj.target}</strong></Text>
                    <Text as="span" size="xs" tone="muted">{obj.period_start} → {obj.period_end}</Text>
                  </div>
                </div>
                <button onClick={() => handleDelete(obj.id)} className="p-2 text-gray-300 hover:text-danger hover:bg-danger/10 rounded-control">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )
          })}
        </Card>
      )}

      {/* Botones modo si ya hay objetivos */}
      {mode === null && objectives.length > 0 && (
        <div className="mt-4 flex gap-2">
          <Button variant="outline" icon={<Zap className="w-3.5 h-3.5" />} onClick={() => setMode('method')}>
            Adoptar un método
          </Button>
          <Button variant="outline" icon={<SlidersHorizontal className="w-3.5 h-3.5" />} onClick={() => setMode('custom')}>
            Agregar personalizado
          </Button>
        </div>
      )}
    </div>
  )
}
