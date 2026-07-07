'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Megaphone, Settings, BarChart3, Activity, Save, Loader2,
  Plus, Trash2, ArrowLeft, Send, AlertCircle, CheckCircle2, Mail,
} from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { getCurrentUser } from '@/lib/auth'
import EmailSection from '@/components/configuracion/EmailSection'

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

  useEffect(() => {
    if (!isAdmin) { setLoading(false); return }
    Promise.all([
      apiFetch('crm', '/marketing/integration').then(r => r.json() as Promise<any>).catch(() => ({})),
      apiFetch('crm', '/marketing/mappings').then(r => r.json() as Promise<any>).catch(() => []),
    ]).then(([cfg, mp]) => {
      setIntegration(cfg || {})
      setMappings(Array.isArray(mp) ? mp : (mp?.mappings || []))
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [isAdmin])

  useEffect(() => {
    if (tab === 'log' && isAdmin) {
      apiFetch('crm', '/marketing/event-log?limit=50')
        .then(r => r.json() as Promise<any>)
        .then(d => setLog(Array.isArray(d) ? d : (d?.events || [])))
        .catch(() => setLog([]))
    }
  }, [tab, isAdmin])

  if (!isAdmin) {
    return (
      <div className="max-w-2xl mx-auto py-12 text-center">
        <AlertCircle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
        <p className="text-gray-700 font-medium">Acceso restringido</p>
        <p className="text-sm text-gray-500 mt-1">Solo administradores pueden configurar el marketing.</p>
      </div>
    )
  }

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

  const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-pink/20 focus:border-brand-pink outline-none'
  const labelCls = 'block text-sm font-medium text-gray-700 mb-1'

  return (
    <div>
      <Link href="/configuracion" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 mb-6">
        <ArrowLeft className="w-4 h-4" /> Volver a Configuración
      </Link>

      {/* Header */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-6 relative overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-pink to-brand-orange" />
        <img src="/brand/GV-27.png" alt="" aria-hidden="true" className="absolute -top-8 -right-8 w-32 h-32 opacity-10 pointer-events-none" />
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-brand-pink to-brand-orange flex items-center justify-center shadow-sm">
            <Megaphone className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-800">Marketing</h1>
            <p className="text-sm text-gray-500 mt-0.5">Meta Conversion API + Google Analytics 4 + GTM</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 bg-gray-100 rounded-xl p-1 max-w-fit">
        {([
          { id: 'config', label: 'Configuración', icon: Settings },
          { id: 'mappings', label: 'Mapeo de eventos', icon: BarChart3 },
          { id: 'log', label: 'Log de eventos', icon: Activity },
          { id: 'email', label: 'Email', icon: Mail },
        ] as const).map(t => {
          const Icon = t.icon
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
                tab === t.id
                  ? 'bg-white text-brand-pink shadow-sm'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              <Icon className="w-3.5 h-3.5" /> {t.label}
            </button>
          )
        })}
      </div>

      {tab === 'config' && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
          {/* Meta */}
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={!!integration.enabled}
              onChange={e => setIntegration({ ...integration, enabled: e.target.checked })}
              className="w-4 h-4 accent-brand-pink"
            />
            <span className="text-sm font-medium text-gray-800">
              Activar Meta Conversion API
            </span>
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Pixel ID</label>
              <input
                value={integration.pixel_id || ''}
                onChange={e => setIntegration({ ...integration, pixel_id: e.target.value })}
                placeholder="1234567890"
                className={inputCls}
              />
            </div>

            <div>
              <label className={labelCls}>GTM Container ID</label>
              <input
                value={integration.gtm_container_id || ''}
                onChange={e => setIntegration({ ...integration, gtm_container_id: e.target.value })}
                placeholder="GTM-XXXXXX"
                className={inputCls}
              />
            </div>

            <div>
              <label className={labelCls}>Ad Account ID</label>
              <input
                value={integration.ad_account_id || ''}
                onChange={e => setIntegration({ ...integration, ad_account_id: e.target.value })}
                placeholder="act_1234567890"
                className={inputCls}
              />
              <p className="text-[10px] text-gray-400 mt-1">
                Lo ves en Meta Ads Manager (act_…). Habilita el panel de campañas — el token debe tener permiso <code>ads_read</code>.
              </p>
            </div>

            <div>
              <label className={labelCls}>Test Event Code (opcional)</label>
              <input
                value={integration.test_event_code || ''}
                onChange={e => setIntegration({ ...integration, test_event_code: e.target.value })}
                placeholder="TEST12345"
                className={inputCls}
              />
            </div>

            <div className="sm:col-span-2">
              <label className={labelCls}>Meta Access Token</label>
              {integration.has_access_token && !showTokenInput ? (
                <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                  <span className="text-sm text-green-700 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" /> Token guardado
                  </span>
                  <button
                    type="button"
                    onClick={() => { setShowTokenInput(true); setAccessTokenInput('') }}
                    className="text-xs text-brand-pink hover:underline font-medium"
                  >
                    Cambiar
                  </button>
                </div>
              ) : (
                <input
                  type="password"
                  value={accessTokenInput}
                  onChange={e => setAccessTokenInput(e.target.value)}
                  placeholder="EAAxx..."
                  className={inputCls}
                />
              )}
              <p className="text-[10px] text-gray-400 mt-1">El token se guarda encriptado (AES-GCM). Nunca se devuelve en plano.</p>
            </div>
          </div>

          {/* GA4 section */}
          <div className="pt-5 mt-5 border-t border-gray-100">
            <label className="flex items-center gap-3 cursor-pointer mb-3">
              <input
                type="checkbox"
                checked={!!integration.ga4_enabled}
                onChange={e => setIntegration({ ...integration, ga4_enabled: e.target.checked })}
                className="w-4 h-4 accent-brand-pink"
              />
              <span className="text-sm font-medium text-gray-800">
                Activar Google Analytics 4 (Measurement Protocol)
              </span>
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>GA4 Measurement ID</label>
                <input
                  value={integration.ga4_measurement_id || ''}
                  onChange={e => setIntegration({ ...integration, ga4_measurement_id: e.target.value })}
                  placeholder="G-XXXXXXXXXX"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>GA4 API Secret</label>
                {integration.has_ga4_api_secret && !showGa4SecretInput ? (
                  <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                    <span className="text-sm text-green-700 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" /> Secret guardado
                    </span>
                    <button
                      type="button"
                      onClick={() => { setShowGa4SecretInput(true); setGa4SecretInput('') }}
                      className="text-xs text-brand-pink hover:underline font-medium"
                    >
                      Cambiar
                    </button>
                  </div>
                ) : (
                  <input
                    type="password"
                    value={ga4SecretInput}
                    onChange={e => setGa4SecretInput(e.target.value)}
                    placeholder="abc123..."
                    className={inputCls}
                  />
                )}
                <p className="text-[10px] text-gray-400 mt-1">
                  Generado en GA4 → Admin → Data Streams → Measurement Protocol API secrets. Encriptado AES-GCM.
                </p>
              </div>
            </div>

            {integration.ga4_enabled && !integration.ga4_measurement_id && (
              <p className="text-[11px] text-amber-600 mt-2">⚠ Agregá un Measurement ID o desactivá GA4.</p>
            )}
          </div>

          <button
            onClick={saveConfig}
            disabled={savingConfig}
            className="bg-gradient-to-br from-brand-pink to-brand-orange text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-2"
          >
            {savingConfig ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Guardar configuración
          </button>
        </div>
      )}

      {tab === 'mappings' && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <p className="text-sm text-gray-500 mb-4">
            Definí qué evento se dispara en Meta y/o GA4 para cada hito del CRM.
            GA4 es opcional — si lo dejás vacío, sólo se dispara Meta.
          </p>

          <div className="grid grid-cols-[1.4fr_1fr_1fr_auto_auto] gap-2 px-2 pb-1 text-[10px] uppercase tracking-wide text-gray-400">
            <span>Evento del CRM</span>
            <span>Meta event</span>
            <span>GA4 event</span>
            <span>Estado</span>
            <span />
          </div>

          {mappings.length === 0 ? (
            <p className="text-center text-xs text-gray-400 py-6 border border-dashed border-gray-200 rounded-xl">
              No hay mapeos configurados. Agregá uno con el botón de abajo.
            </p>
          ) : (
            <div className="space-y-2">
              {mappings.map((m, i) => (
                <div key={i} className="grid grid-cols-[1.4fr_1fr_1fr_auto_auto] items-center gap-2 border border-gray-100 rounded-xl p-2">
                  <select
                    value={m.stage_key}
                    onChange={e => { const n = [...mappings]; n[i] = { ...m, stage_key: e.target.value }; setMappings(n) }}
                    className={inputCls}
                  >
                    {EVENT_KEY_GROUPS.map(g => (
                      <optgroup key={g.label} label={g.label}>
                        {g.keys.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                      </optgroup>
                    ))}
                  </select>
                  <input
                    list="meta-events"
                    value={m.meta_event_name}
                    onChange={e => { const n = [...mappings]; n[i] = { ...m, meta_event_name: e.target.value }; setMappings(n) }}
                    placeholder="Lead"
                    className={inputCls}
                  />
                  <input
                    list="ga4-events"
                    value={m.ga4_event_name || ''}
                    onChange={e => { const n = [...mappings]; n[i] = { ...m, ga4_event_name: e.target.value }; setMappings(n) }}
                    placeholder="generate_lead (opcional)"
                    className={inputCls}
                  />
                  <label className="flex items-center gap-1 text-xs cursor-pointer px-1">
                    <input
                      type="checkbox"
                      checked={m.enabled}
                      onChange={e => { const n = [...mappings]; n[i] = { ...m, enabled: e.target.checked }; setMappings(n) }}
                      className="w-4 h-4 accent-brand-pink"
                    />
                    Activo
                  </label>
                  <button onClick={() => deleteMapping(m)} className="text-red-400 hover:text-red-600 p-1.5">
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
              className="flex items-center gap-1 text-xs text-brand-pink font-medium hover:underline"
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
              className="flex items-center gap-1 text-xs text-brand-orange font-medium hover:underline"
            >
              <CheckCircle2 className="w-3 h-3" /> Usar mapeos recomendados
            </button>
          </div>

          <button
            onClick={saveMappings}
            disabled={savingMappings}
            className="mt-4 bg-gradient-to-br from-brand-pink to-brand-orange text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-2"
          >
            {savingMappings ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Guardar mapeos
          </button>
        </div>
      )}

      {tab === 'email' && <EmailSection />}

      {tab === 'log' && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-700">Últimos 50 eventos</h2>
            <button
              onClick={() => setShowTestModal(true)}
              className="flex items-center gap-1.5 bg-gradient-to-br from-brand-pink to-brand-orange text-white text-xs font-medium px-3 py-1.5 rounded-lg hover:opacity-90"
            >
              <Send className="w-3 h-3" /> Probar evento
            </button>
          </div>

          {log.length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-8">Sin eventos registrados todavía</p>
          ) : (
            <div className="space-y-1.5">
              {log.map(e => {
                const providerBadge =
                  e.provider === 'meta' ? 'bg-blue-100 text-blue-700' :
                  e.provider === 'ga4' ? 'bg-amber-100 text-amber-700' :
                  'bg-gray-100 text-gray-600'
                return (
                  <div key={e.id} className="flex items-center justify-between border border-gray-100 rounded-lg px-3 py-2 text-xs">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={`px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${
                        e.status === 'sent' ? 'bg-green-100 text-green-700' :
                        e.status === 'failed' ? 'bg-red-100 text-red-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>{e.status}</span>
                      {e.provider && (
                        <span className={`px-2 py-0.5 rounded-full font-medium uppercase tracking-wide text-[10px] ${providerBadge}`}>
                          {e.provider}
                        </span>
                      )}
                      <span className="font-medium text-gray-800 whitespace-nowrap">{e.event_name}</span>
                      {e.entity_type && e.entity_id && (
                        <span className="text-gray-500 whitespace-nowrap">
                          {e.entity_type}:
                          {(e.entity_type === 'lead') ? (
                            <Link href={`/leads/${e.entity_id}`} className="text-brand-pink hover:underline ml-1">
                              {e.entity_id.slice(0, 8)}…
                            </Link>
                          ) : (
                            <span className="ml-1 font-mono">{e.entity_id.slice(0, 8)}…</span>
                          )}
                        </span>
                      )}
                      {!e.entity_id && e.lead_id && (
                        <Link href={`/leads/${e.lead_id}`} className="text-brand-pink hover:underline truncate">
                          {e.lead_id.slice(0, 8)}…
                        </Link>
                      )}
                      {e.last_error && (
                        <span className="text-red-500 truncate" title={e.last_error}>{e.last_error.slice(0, 40)}</span>
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
        </div>
      )}

      {showTestModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowTestModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-brand-pink to-brand-orange h-1.5" />
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Probar evento</h3>
              <label className={labelCls}>Evento a simular</label>
              <select value={testStage} onChange={e => setTestStage(e.target.value)} className={`${inputCls} mb-3`}>
                {EVENT_KEY_GROUPS.map(g => (
                  <optgroup key={g.label} label={g.label}>
                    {g.keys.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                  </optgroup>
                ))}
              </select>
              <button
                onClick={runTestEvent}
                disabled={testRunning}
                className="w-full bg-gradient-to-br from-brand-pink to-brand-orange text-white py-2 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 inline-flex items-center justify-center gap-2"
              >
                {testRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Disparar evento de prueba
              </button>

              {testResult && (
                testResult.error ? (
                  <div className="mt-4 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700">
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
                            <div key={prov} className="border border-dashed border-gray-200 rounded-lg p-3 text-center text-[10px] text-gray-400">
                              {prov.toUpperCase()}: no enviado
                            </div>
                          )
                        }
                        const ok = r.status === 'sent'
                        const noop = r.status === 'noop' || r.status === 'disabled'
                        const cls = ok
                          ? 'border-green-200 bg-green-50/40'
                          : noop
                            ? 'border-gray-200 bg-gray-50/40'
                            : 'border-red-200 bg-red-50/40'
                        const badgeCls = ok
                          ? 'bg-green-100 text-green-700'
                          : noop
                            ? 'bg-gray-200 text-gray-700'
                            : 'bg-red-100 text-red-700'
                        return (
                          <div key={prov} className={`border rounded-lg p-3 ${cls}`}>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[10px] font-semibold uppercase text-gray-600">{prov}</span>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${badgeCls}`}>
                                {r.status}{typeof r.http_status === 'number' ? ` · ${r.http_status}` : ''}
                              </span>
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

              <button onClick={() => setShowTestModal(false)} className="w-full border border-gray-200 text-gray-700 text-sm font-medium py-2 rounded-lg mt-3 hover:bg-gray-50">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Info section */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-900">
        <p className="font-medium mb-1">📊 Cómo funciona la deduplicación</p>
        <p className="text-blue-800">
          Cada evento usa un <code className="bg-white px-1 rounded">event_id</code> determinístico
          (org + entidad + evento + día). El frontend lo pushea al <code className="bg-white px-1 rounded">dataLayer</code>{' '}
          para que el Pixel cliente lo use, y el backend lo manda igual a Meta CAPI / GA4 MP.
          Meta y GA4 dedupean los duplicados automáticamente.
        </p>
        <p className="text-blue-800 mt-2">
          El script de GTM se inyecta en tus páginas públicas
          (<code className="bg-white px-1 rounded">/r/&lt;slug&gt;</code>, <code className="bg-white px-1 rounded">/t/&lt;slug&gt;</code>,
          {' '}<code className="bg-white px-1 rounded">/v/&lt;slug&gt;</code>, <code className="bg-white px-1 rounded">/l/&lt;slug&gt;</code>)
          cuando configurás tu Container ID arriba.
        </p>
      </div>
    </div>
  )
}
