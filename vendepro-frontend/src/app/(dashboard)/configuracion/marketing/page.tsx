'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Megaphone, Settings, BarChart3, Activity, Save, Loader2,
  Plus, Trash2, ArrowLeft, Send, CheckCircle2, Mail,
} from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { getCurrentUser } from '@/lib/auth'
import EmailSection from '@/components/configuracion/EmailSection'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Text } from '@/components/ui/Typography'
import { Field, Input, Select } from '@/components/ui/Input'
import { Checkbox } from '@/components/ui/Choice'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Modal } from '@/components/ui/Modal'
import { Alert } from '@/components/ui/Alert'

const EVENT_KEY_GROUPS: { label: string; keys: { key: string; label: string }[] }[] = [
  {
    label: 'Lead — cambio de etapa',
    keys: [
      { key: 'nuevo', label: 'Nuevo' },
      { key: 'asignado', label: 'Asignado' },
      { key: 'contactado', label: 'Contactado' },
      { key: 'calificado', label: 'Calificado' },
      { key: 'en_tasacion', label: 'En tasación' },
      { key: 'presentada', label: 'Presentada' },
      { key: 'seguimiento', label: 'Seguimiento' },
      { key: 'captado', label: 'Captado' },
      { key: 'perdido', label: 'Perdido' },
    ],
  },
  {
    label: 'Lifecycle (creación)',
    keys: [
      { key: 'lead_created', label: 'Lead creado' },
      { key: 'appraisal_created', label: 'Tasación creada' },
      { key: 'reservation_created', label: 'Reserva creada' },
      { key: 'reservation_reservada', label: 'Reserva → Reservada' },
      { key: 'reservation_escriturada', label: 'Reserva → Escriturada' },
    ],
  },
  {
    label: 'Público (web/landing)',
    keys: [
      { key: 'visit_form_submitted', label: 'Ficha de visita enviada' },
      { key: 'landing_lead_submitted', label: 'Landing — formulario enviado' },
      { key: 'landing_viewed', label: 'Landing — view' },
    ],
  },
]

const ALL_EVENT_KEYS = EVENT_KEY_GROUPS.flatMap(g => g.keys)

// Set recomendado para el funnel inmobiliario: cubre lead → contacto →
// calificación → tasación → captación → venta. Meta optimiza campañas con
// eventos estándar; Purchase queda reservado para la venta real (escriturada).
const RECOMMENDED_MAPPINGS: Mapping[] = [
  { stage_key: 'lead_created', meta_event_name: 'Lead', ga4_event_name: 'generate_lead', enabled: true },
  { stage_key: 'contactado', meta_event_name: 'Contact', ga4_event_name: 'contacto_lead', enabled: true },
  { stage_key: 'calificado', meta_event_name: 'CompleteRegistration', ga4_event_name: 'lead_calificado', enabled: true },
  { stage_key: 'en_tasacion', meta_event_name: 'Schedule', ga4_event_name: 'tasacion_agendada', enabled: true },
  { stage_key: 'captado', meta_event_name: 'SubmitApplication', ga4_event_name: 'captacion', enabled: true },
  { stage_key: 'reservation_escriturada', meta_event_name: 'Purchase', ga4_event_name: 'purchase', enabled: true },
]

const META_EVENT_SUGGESTIONS = [
  'Lead', 'Schedule', 'Contact', 'Purchase', 'CompleteRegistration',
  'ViewContent', 'AddToCart', 'InitiateCheckout', 'Subscribe', 'SubmitApplication',
]
const GA4_EVENT_SUGGESTIONS = [
  'generate_lead', 'sign_up', 'qualify_lead', 'working_lead',
  'schedule', 'view_item', 'select_item', 'form_submit', 'purchase',
]

interface Integration {
  pixel_id?: string
  stape_endpoint?: string
  gtm_container_id?: string
  test_event_code?: string
  ad_account_id?: string
  enabled?: boolean
  has_access_token?: boolean
  ga4_enabled?: boolean
  ga4_measurement_id?: string
  has_ga4_api_secret?: boolean
}

interface Mapping {
  id?: string
  stage_key: string
  meta_event_name: string
  ga4_event_name?: string | null
  enabled: boolean
}

interface ProviderResult {
  status: string
  reason?: string
  log_id?: string
  http_status?: number
  body?: string
  event_name?: string
}

interface TestResult {
  event_id?: string
  meta?: ProviderResult
  ga4?: ProviderResult
  error?: string
}

interface EventLog {
  id: string
  provider?: 'meta' | 'ga4' | string
  entity_type?: string | null
  entity_id?: string | null
  lead_id?: string | null
  event_id?: string
  event_name: string
  status: string
  response_code?: number | null
  attempts?: number
  sent_at?: string | null
  created_at?: string
  last_error?: string | null
}

export default function MarketingConfigPage() {
  const { toast } = useToast()
  const profile = getCurrentUser()
  const isAdmin = profile?.role === 'admin' || profile?.role === 'owner'

  const [tab, setTab] = useState<'config' | 'mappings' | 'log' | 'email'>('config')
  const [loading, setLoading] = useState(true)

  const [integration, setIntegration] = useState<Integration>({})
  const [accessTokenInput, setAccessTokenInput] = useState('')
  const [showTokenInput, setShowTokenInput] = useState(false)
  const [ga4SecretInput, setGa4SecretInput] = useState('')
  const [showGa4SecretInput, setShowGa4SecretInput] = useState(false)
  const [savingConfig, setSavingConfig] = useState(false)

  const [mappings, setMappings] = useState<Mapping[]>([])
  const [savingMappings, setSavingMappings] = useState(false)

  const [log, setLog] = useState<EventLog[]>([])
  const [showTestModal, setShowTestModal] = useState(false)
  const [testStage, setTestStage] = useState('lead_created')
  const [testResult, setTestResult] = useState<TestResult | null>(null)
  const [testRunning, setTestRunning] = useState(false)

  // La config de pixel/GA4 es por-agente: todo usuario carga la suya.
  // Los mapeos etapa→evento son de la org (solo admin los edita).
  useEffect(() => {
    Promise.all([
      apiFetch('crm', '/marketing/integration').then(r => r.json() as Promise<any>).catch(() => ({})),
      apiFetch('crm', '/marketing/mappings').then(r => r.json() as Promise<any>).catch(() => []),
    ]).then(([cfg, mp]) => {
      setIntegration(cfg || {})
      setMappings(Array.isArray(mp) ? mp : (mp?.mappings || []))
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (tab === 'log') {
      apiFetch('crm', '/marketing/event-log?limit=50')
        .then(r => r.json() as Promise<any>)
        .then(d => setLog(Array.isArray(d) ? d : (d?.events || [])))
        .catch(() => setLog([]))
    }
  }, [tab])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-brand-pink" />
      </div>
    )
  }

  async function saveConfig() {
    if (integration.ga4_enabled && !integration.ga4_measurement_id) {
      toast('Completá Measurement ID o desactivá GA4', 'error')
      return
    }
    setSavingConfig(true)
    try {
      const body: any = {
        pixel_id: integration.pixel_id || null,
        stape_endpoint: integration.stape_endpoint || null,
        gtm_container_id: integration.gtm_container_id || null,
        test_event_code: integration.test_event_code || null,
        ad_account_id: integration.ad_account_id || null,
        enabled: !!integration.enabled,
        ga4_enabled: !!integration.ga4_enabled,
        ga4_measurement_id: integration.ga4_measurement_id || null,
      }
      // El input de token también está visible cuando nunca se guardó uno
      // (has_access_token false), sin pasar por "Cambiar" — mandar siempre
      // que haya valor tipeado.
      if (accessTokenInput) body.access_token = accessTokenInput
      if (ga4SecretInput) body.ga4_api_secret = ga4SecretInput
      const res = await apiFetch('crm', '/marketing/integration', {
        method: 'PUT',
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error()
      toast('Configuración guardada')
      setShowTokenInput(false)
      setAccessTokenInput('')
      setShowGa4SecretInput(false)
      setGa4SecretInput('')
      setIntegration(prev => ({
        ...prev,
        has_access_token: !!body.access_token || prev.has_access_token,
        has_ga4_api_secret: !!body.ga4_api_secret || prev.has_ga4_api_secret,
      }))
    } catch {
      toast('Error guardando configuración', 'error')
    }
    setSavingConfig(false)
  }

  async function saveMappings() {
    setSavingMappings(true)
    try {
      for (const m of mappings) {
        await apiFetch('crm', '/marketing/mappings', {
          method: 'POST',
          body: JSON.stringify({
            stage_key: m.stage_key,
            meta_event_name: m.meta_event_name,
            ga4_event_name: m.ga4_event_name || null,
            enabled: m.enabled,
          }),
        })
      }
      toast('Mapeos guardados')
    } catch {
      toast('Error guardando mapeos', 'error')
    }
    setSavingMappings(false)
  }

  async function deleteMapping(m: Mapping) {
    if (m.id) {
      try { await apiFetch('crm', `/marketing/mappings/${m.id}`, { method: 'DELETE' }) } catch {}
    }
    setMappings(mappings.filter(x => x !== m))
  }

  async function runTestEvent() {
    setTestRunning(true)
    setTestResult(null)
    try {
      const res = await apiFetch('crm', '/marketing/test-event', {
        method: 'POST',
        body: JSON.stringify({ stage_key: testStage }),
      })
      const data = (await res.json()) as TestResult
      setTestResult(data)
    } catch (e: any) {
      setTestResult({ error: e?.message || 'Error' })
    }
    setTestRunning(false)
  }

  return (
    <div>
      <Link href="/configuracion" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-ink mb-6">
        <ArrowLeft className="w-4 h-4" /> Volver a Configuración
      </Link>

      {/* Header propio (hero con ícono degradado + imagen decorativa) — se deja como está */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-6 relative overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-pink to-brand-orange" />
        <img src="/brand/GV-27.png" alt="" aria-hidden="true" className="absolute -top-8 -right-8 w-32 h-32 opacity-10 pointer-events-none" />
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-brand-pink to-brand-orange flex items-center justify-center shadow-sm">
            <Megaphone className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-ink">Marketing</h1>
            <p className="text-sm text-gray-500 mt-0.5">Tu Meta Pixel + Google Analytics 4 + GTM — la configuración es por agente</p>
          </div>
        </div>
      </div>

      {/* Tabs con ícono por item + lista condicional por rol — no mapea 1:1 a
          Tabs/SegmentedControl (sin soporte de ícono). ds-todo: candidato a
          variante "SegmentedControl con ícono" cuando se decida en tanda. */}
      <div className="flex gap-1 mb-5 bg-gray-100 rounded-xl p-1 max-w-fit">
        {([
          { id: 'config', label: 'Configuración', icon: Settings },
          // Mapeos (funnel de la org) y Email son admin-only.
          ...(isAdmin ? [{ id: 'mappings', label: 'Mapeo de eventos', icon: BarChart3 }] as const : []),
          { id: 'log', label: 'Log de eventos', icon: Activity },
          ...(isAdmin ? [{ id: 'email', label: 'Email', icon: Mail }] as const : []),
        ] as { id: 'config' | 'mappings' | 'log' | 'email'; label: string; icon: typeof Settings }[]).map(t => {
          const Icon = t.icon
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
                tab === t.id
                  ? 'bg-white text-brand-pink shadow-sm'
                  : 'text-gray-600 hover:text-ink'
              }`}
            >
              <Icon className="w-3.5 h-3.5" /> {t.label}
            </button>
          )
        })}
      </div>

      {tab === 'config' && (
        <Card className="space-y-4">
          {/* Meta */}
          <Checkbox
            checked={!!integration.enabled}
            onChange={checked => setIntegration({ ...integration, enabled: checked })}
            label="Activar Meta Conversion API"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Pixel ID">
              <Input
                value={integration.pixel_id || ''}
                onChange={e => setIntegration({ ...integration, pixel_id: e.target.value })}
                placeholder="1234567890"
              />
            </Field>

            <Field label="GTM Container ID">
              <Input
                value={integration.gtm_container_id || ''}
                onChange={e => setIntegration({ ...integration, gtm_container_id: e.target.value })}
                placeholder="GTM-XXXXXX"
              />
            </Field>

            <Field label="Ad Account ID">
              <Input
                value={integration.ad_account_id || ''}
                onChange={e => setIntegration({ ...integration, ad_account_id: e.target.value })}
                placeholder="act_1234567890"
              />
              <p className="text-[10px] text-gray-400 mt-1">
                Lo ves en Meta Ads Manager (act_…). Habilita el panel de campañas — el token debe tener permiso <code>ads_read</code>.
              </p>
            </Field>

            <Field label="Test Event Code (opcional)">
              <Input
                value={integration.test_event_code || ''}
                onChange={e => setIntegration({ ...integration, test_event_code: e.target.value })}
                placeholder="TEST12345"
              />
            </Field>

            <Field label="Meta Access Token" className="sm:col-span-2">
              {integration.has_access_token && !showTokenInput ? (
                <div className="flex items-center justify-between bg-success/10 border border-success/30 rounded-control px-3 py-2">
                  <span className="text-sm text-ink flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-success" /> Token guardado
                  </span>
                  <button
                    type="button"
                    onClick={() => { setShowTokenInput(true); setAccessTokenInput('') }}
                    className="text-xs text-primary hover:underline font-medium"
                  >
                    Cambiar
                  </button>
                </div>
              ) : (
                <Input
                  type="password"
                  value={accessTokenInput}
                  onChange={e => setAccessTokenInput(e.target.value)}
                  placeholder="EAAxx..."
                />
              )}
              <p className="text-[10px] text-gray-400 mt-1">El token se guarda encriptado (AES-GCM). Nunca se devuelve en plano.</p>
            </Field>
          </div>

          {/* GA4 section */}
          <div className="pt-5 mt-5 border-t border-gray-100">
            <Checkbox
              checked={!!integration.ga4_enabled}
              onChange={checked => setIntegration({ ...integration, ga4_enabled: checked })}
              label="Activar Google Analytics 4 (Measurement Protocol)"
              className="mb-3"
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="GA4 Measurement ID">
                <Input
                  value={integration.ga4_measurement_id || ''}
                  onChange={e => setIntegration({ ...integration, ga4_measurement_id: e.target.value })}
                  placeholder="G-XXXXXXXXXX"
                />
              </Field>
              <Field label="GA4 API Secret">
                {integration.has_ga4_api_secret && !showGa4SecretInput ? (
                  <div className="flex items-center justify-between bg-success/10 border border-success/30 rounded-control px-3 py-2">
                    <span className="text-sm text-ink flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-success" /> Secret guardado
                    </span>
                    <button
                      type="button"
                      onClick={() => { setShowGa4SecretInput(true); setGa4SecretInput('') }}
                      className="text-xs text-primary hover:underline font-medium"
                    >
                      Cambiar
                    </button>
                  </div>
                ) : (
                  <Input
                    type="password"
                    value={ga4SecretInput}
                    onChange={e => setGa4SecretInput(e.target.value)}
                    placeholder="abc123..."
                  />
                )}
                <p className="text-[10px] text-gray-400 mt-1">
                  Generado en GA4 → Admin → Data Streams → Measurement Protocol API secrets. Encriptado AES-GCM.
                </p>
              </Field>
            </div>

            {integration.ga4_enabled && !integration.ga4_measurement_id && (
              <p className="text-[11px] text-warning mt-2">⚠ Agregá un Measurement ID o desactivá GA4.</p>
            )}
          </div>

          <Button onClick={saveConfig} loading={savingConfig} icon={<Save className="w-4 h-4" />}>
            Guardar configuración
          </Button>
        </Card>
      )}

      {tab === 'mappings' && (
        <Card>
          <Text tone="muted" className="mb-4">
            Definí qué evento se dispara en Meta y/o GA4 para cada hito del CRM.
            GA4 es opcional — si lo dejás vacío, sólo se dispara Meta.
          </Text>

          <div className="grid grid-cols-[1.4fr_1fr_1fr_auto_auto] gap-2 px-2 pb-1 text-[10px] uppercase tracking-wide text-gray-400">
            <span>Evento del CRM</span>
            <span>Meta event</span>
            <span>GA4 event</span>
            <span>Estado</span>
            <span />
          </div>

          {mappings.length === 0 ? (
            <EmptyState title="No hay mapeos configurados" description="Agregá uno con el botón de abajo." />
          ) : (
            <div className="space-y-2">
              {mappings.map((m, i) => (
                <div key={i} className="grid grid-cols-[1.4fr_1fr_1fr_auto_auto] items-center gap-2 border border-gray-100 rounded-xl p-2">
                  <Select
                    value={m.stage_key}
                    onChange={e => { const n = [...mappings]; n[i] = { ...m, stage_key: e.target.value }; setMappings(n) }}
                  >
                    {EVENT_KEY_GROUPS.map(g => (
                      <optgroup key={g.label} label={g.label}>
                        {g.keys.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                      </optgroup>
                    ))}
                  </Select>
                  <Input
                    list="meta-events"
                    value={m.meta_event_name}
                    onChange={e => { const n = [...mappings]; n[i] = { ...m, meta_event_name: e.target.value }; setMappings(n) }}
                    placeholder="Lead"
                  />
                  <Input
                    list="ga4-events"
                    value={m.ga4_event_name || ''}
                    onChange={e => { const n = [...mappings]; n[i] = { ...m, ga4_event_name: e.target.value }; setMappings(n) }}
                    placeholder="generate_lead (opcional)"
                  />
                  <Checkbox
                    checked={m.enabled}
                    onChange={checked => { const n = [...mappings]; n[i] = { ...m, enabled: checked }; setMappings(n) }}
                    label="Activo"
                    className="px-1 text-xs"
                  />
                  <button onClick={() => deleteMapping(m)} className="text-gray-300 hover:text-danger p-1.5">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <datalist id="meta-events">
            {META_EVENT_SUGGESTIONS.map(e => <option key={e} value={e} />)}
          </datalist>
          <datalist id="ga4-events">
            {GA4_EVENT_SUGGESTIONS.map(e => <option key={e} value={e} />)}
          </datalist>

          <div className="flex items-center gap-4 mt-3">
            <button
              onClick={() => setMappings([...mappings, { stage_key: 'lead_created', meta_event_name: 'Lead', ga4_event_name: 'generate_lead', enabled: true }])}
              className="flex items-center gap-1 text-xs text-primary font-medium hover:underline"
            >
              <Plus className="w-3 h-3" /> Agregar mapeo
            </button>
            <button
              onClick={() => {
                const existing = new Set(mappings.map(m => m.stage_key))
                const missing = RECOMMENDED_MAPPINGS.filter(r => !existing.has(r.stage_key))
                if (missing.length === 0) {
                  toast('Ya tenés todos los mapeos recomendados')
                  return
                }
                setMappings([...mappings, ...missing.map(r => ({ ...r }))])
                toast(`${missing.length} mapeos recomendados agregados — revisá y guardá`)
              }}
              className="flex items-center gap-1 text-xs text-primary font-medium hover:underline"
            >
              <CheckCircle2 className="w-3 h-3" /> Usar mapeos recomendados
            </button>
          </div>

          <Button onClick={saveMappings} loading={savingMappings} icon={<Save className="w-4 h-4" />} className="mt-4">
            Guardar mapeos
          </Button>
        </Card>
      )}

      {tab === 'email' && <EmailSection />}

      {tab === 'log' && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <Text weight="semibold" tone="muted">Últimos 50 eventos</Text>
            <Button size="sm" onClick={() => setShowTestModal(true)} icon={<Send className="w-3 h-3" />}>
              Probar evento
            </Button>
          </div>

          {log.length === 0 ? (
            <EmptyState title="Sin eventos registrados todavía" />
          ) : (
            <div className="space-y-1.5">
              {log.map(e => {
                const providerTone =
                  e.provider === 'meta' ? 'info' :
                  e.provider === 'ga4' ? 'warning' :
                  'neutral'
                const statusTone =
                  e.status === 'sent' ? 'success' :
                  e.status === 'failed' ? 'danger' :
                  'neutral'
                return (
                  <div key={e.id} className="flex items-center justify-between border border-gray-100 rounded-lg px-3 py-2 text-xs">
                    <div className="flex items-center gap-3 min-w-0">
                      <Badge tone={statusTone} className="whitespace-nowrap">{e.status}</Badge>
                      {e.provider && (
                        <Badge tone={providerTone} className="uppercase tracking-wide text-[10px]">{e.provider}</Badge>
                      )}
                      <span className="font-medium text-ink whitespace-nowrap">{e.event_name}</span>
                      {e.entity_type && e.entity_id && (
                        <span className="text-gray-500 whitespace-nowrap">
                          {e.entity_type}:
                          {(e.entity_type === 'lead') ? (
                            <Link href={`/leads/${e.entity_id}`} className="text-primary hover:underline ml-1">
                              {e.entity_id.slice(0, 8)}…
                            </Link>
                          ) : (
                            <span className="ml-1 font-mono">{e.entity_id.slice(0, 8)}…</span>
                          )}
                        </span>
                      )}
                      {!e.entity_id && e.lead_id && (
                        <Link href={`/leads/${e.lead_id}`} className="text-primary hover:underline truncate">
                          {e.lead_id.slice(0, 8)}…
                        </Link>
                      )}
                      {e.last_error && (
                        <span className="text-danger truncate" title={e.last_error}>{e.last_error.slice(0, 40)}</span>
                      )}
                    </div>
                    <span className="text-gray-400 whitespace-nowrap">
                      {(e.sent_at || e.created_at) ? new Date(e.sent_at || e.created_at!).toLocaleString('es-AR') : '—'}
                      {e.attempts ? ` · ${e.attempts} intentos` : ''}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </Card>
      )}

      <Modal
        open={showTestModal}
        onClose={() => setShowTestModal(false)}
        title="Probar evento"
        icon={<Send className="w-4 h-4" />}
        className="max-w-2xl"
        footer={
          <Button variant="outline" onClick={() => setShowTestModal(false)}>
            Cerrar
          </Button>
        }
      >
        <Field label="Evento a simular">
          <Select value={testStage} onChange={e => setTestStage(e.target.value)}>
            {EVENT_KEY_GROUPS.map(g => (
              <optgroup key={g.label} label={g.label}>
                {g.keys.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
              </optgroup>
            ))}
          </Select>
        </Field>
        <Button fullWidth onClick={runTestEvent} loading={testRunning} icon={<Send className="w-4 h-4" />} className="mt-3">
          Disparar evento de prueba
        </Button>

        {testResult && (
          testResult.error ? (
            <div className="mt-4 bg-danger/10 border border-danger/30 rounded-control px-3 py-2 text-xs text-danger">
              {testResult.error}
            </div>
          ) : (
            <div className="mt-4 space-y-2">
              {testResult.event_id && (
                <p className="text-[11px] text-gray-500">
                  event_id: <code className="font-mono text-gray-700 break-all">{testResult.event_id}</code>
                </p>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {(['meta', 'ga4'] as const).map(prov => {
                  const r = testResult[prov]
                  if (!r || r.status === 'skipped') {
                    return (
                      <div key={prov} className="border border-dashed border-gray-200 rounded-control p-3 text-center text-[10px] text-gray-400">
                        {prov.toUpperCase()}: no enviado
                      </div>
                    )
                  }
                  const ok = r.status === 'sent'
                  const noop = r.status === 'noop' || r.status === 'disabled'
                  const cls = ok
                    ? 'border-success/30 bg-success/5'
                    : noop
                      ? 'border-gray-200 bg-gray-50/40'
                      : 'border-danger/30 bg-danger/5'
                  const badgeTone = ok ? 'success' : noop ? 'neutral' : 'danger'
                  return (
                    <div key={prov} className={`border rounded-control p-3 ${cls}`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-semibold uppercase text-gray-600">{prov}</span>
                        <Badge tone={badgeTone} className="text-[10px] px-1.5 py-0.5">
                          {r.status}{typeof r.http_status === 'number' ? ` · ${r.http_status}` : ''}
                        </Badge>
                      </div>
                      {r.event_name && (
                        <p className="text-[10px] text-gray-500 mb-1">event: <code>{r.event_name}</code></p>
                      )}
                      {r.reason && <p className="text-[10px] text-gray-500 mb-1">{r.reason}</p>}
                      {r.body && (
                        <pre className="bg-white border border-gray-100 rounded p-2 text-[10px] overflow-x-auto max-h-32">
                          {r.body}
                        </pre>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        )}
      </Modal>

      {/* Info section */}
      <Alert tone="info" title="📊 Cómo funciona la deduplicación" hideIcon className="mt-6">
        <p>
          Cada evento usa un <code className="bg-white px-1 rounded">event_id</code> determinístico
          (org + entidad + evento + día). El frontend lo pushea al <code className="bg-white px-1 rounded">dataLayer</code>{' '}
          para que el Pixel cliente lo use, y el backend lo manda igual a Meta CAPI / GA4 MP.
          Meta y GA4 dedupean los duplicados automáticamente.
        </p>
        <p className="mt-2">
          El script de GTM se inyecta en tus páginas públicas
          (<code className="bg-white px-1 rounded">/r/&lt;slug&gt;</code>, <code className="bg-white px-1 rounded">/t/&lt;slug&gt;</code>,
          {' '}<code className="bg-white px-1 rounded">/v/&lt;slug&gt;</code>, <code className="bg-white px-1 rounded">/l/&lt;slug&gt;</code>)
          cuando configurás tu Container ID arriba.
        </p>
      </Alert>
    </div>
  )
}
