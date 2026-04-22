'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Megaphone, Settings, BarChart3, Activity, Save, Loader2,
  Plus, Trash2, ArrowLeft, Send, AlertCircle, CheckCircle2,
} from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { getCurrentUser } from '@/lib/auth'

const STAGE_KEYS = [
  { key: 'nuevo', label: 'Nuevo' },
  { key: 'asignado', label: 'Asignado' },
  { key: 'contactado', label: 'Contactado' },
  { key: 'calificado', label: 'Calificado' },
  { key: 'en_tasacion', label: 'En tasación' },
  { key: 'presentada', label: 'Presentada' },
  { key: 'seguimiento', label: 'Seguimiento' },
  { key: 'captado', label: 'Captado' },
  { key: 'perdido', label: 'Perdido' },
]

const META_EVENT_SUGGESTIONS = [
  'Lead', 'Schedule', 'Contact', 'Purchase', 'CompleteRegistration',
  'ViewContent', 'AddToCart', 'InitiateCheckout', 'Subscribe',
]

interface Integration {
  pixel_id?: string
  stape_endpoint?: string
  gtm_container_id?: string
  test_event_code?: string
  enabled?: boolean
  has_access_token?: boolean
}

interface Mapping {
  id?: string
  stage_key: string
  meta_event_name: string
  enabled: boolean
}

interface EventLog {
  id: string
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

  const [tab, setTab] = useState<'config' | 'mappings' | 'log'>('config')
  const [loading, setLoading] = useState(true)

  const [integration, setIntegration] = useState<Integration>({})
  const [accessTokenInput, setAccessTokenInput] = useState('')
  const [showTokenInput, setShowTokenInput] = useState(false)
  const [savingConfig, setSavingConfig] = useState(false)

  const [mappings, setMappings] = useState<Mapping[]>([])
  const [savingMappings, setSavingMappings] = useState(false)

  const [log, setLog] = useState<EventLog[]>([])
  const [showTestModal, setShowTestModal] = useState(false)
  const [testStage, setTestStage] = useState('calificado')
  const [testResult, setTestResult] = useState<any>(null)
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
        <Loader2 className="w-8 h-8 animate-spin text-[#ff007c]" />
      </div>
    )
  }

  async function saveConfig() {
    setSavingConfig(true)
    try {
      const body: any = {
        pixel_id: integration.pixel_id || null,
        stape_endpoint: integration.stape_endpoint || null,
        gtm_container_id: integration.gtm_container_id || null,
        test_event_code: integration.test_event_code || null,
        enabled: !!integration.enabled,
      }
      if (showTokenInput && accessTokenInput) {
        body.access_token = accessTokenInput
      }
      const res = await apiFetch('crm', '/marketing/integration', {
        method: 'PUT',
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error()
      toast('Configuración guardada')
      setShowTokenInput(false)
      setAccessTokenInput('')
      setIntegration(prev => ({ ...prev, has_access_token: !!body.access_token || prev.has_access_token }))
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
      const data = await res.json()
      setTestResult(data)
    } catch (e: any) {
      setTestResult({ error: e?.message || 'Error' })
    }
    setTestRunning(false)
  }

  const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#ff007c]/20 focus:border-[#ff007c] outline-none'
  const labelCls = 'block text-sm font-medium text-gray-700 mb-1'

  return (
    <div>
      <Link href="/configuracion" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 mb-6">
        <ArrowLeft className="w-4 h-4" /> Volver a Configuración
      </Link>

      {/* Header */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-6 relative overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#ff007c] to-[#ff8017]" />
        <img src="/brand/GV-27.png" alt="" aria-hidden="true" className="absolute -top-8 -right-8 w-32 h-32 opacity-10 pointer-events-none" />
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#ff007c] to-[#ff8017] flex items-center justify-center shadow-sm">
            <Megaphone className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-800">Marketing</h1>
            <p className="text-sm text-gray-500 mt-0.5">Integración con Meta Conversion API + Google Tag Manager</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 bg-gray-100 rounded-xl p-1 max-w-fit">
        {([
          { id: 'config', label: 'Configuración', icon: Settings },
          { id: 'mappings', label: 'Mapeo de etapas', icon: BarChart3 },
          { id: 'log', label: 'Log de eventos', icon: Activity },
        ] as const).map(t => {
          const Icon = t.icon
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
                tab === t.id
                  ? 'bg-white text-[#ff007c] shadow-sm'
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
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={!!integration.enabled}
              onChange={e => setIntegration({ ...integration, enabled: e.target.checked })}
              className="w-4 h-4 accent-[#ff007c]"
            />
            <span className="text-sm font-medium text-gray-800">
              Activar integración con Meta
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

            <div className="sm:col-span-2">
              <label className={labelCls}>Stape Endpoint</label>
              <input
                value={integration.stape_endpoint || ''}
                onChange={e => setIntegration({ ...integration, stape_endpoint: e.target.value })}
                placeholder="https://hbngsuvn.sad.stape.io"
                className={inputCls}
              />
              <p className="text-[10px] text-gray-400 mt-1">Si no configurás Stape, se usa graph.facebook.com directo.</p>
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
              <label className={labelCls}>Access Token</label>
              {integration.has_access_token && !showTokenInput ? (
                <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                  <span className="text-sm text-green-700 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" /> Token guardado
                  </span>
                  <button
                    type="button"
                    onClick={() => { setShowTokenInput(true); setAccessTokenInput('') }}
                    className="text-xs text-[#ff007c] hover:underline font-medium"
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
              <p className="text-[10px] text-gray-400 mt-1">El token se guarda encriptado (AES-GCM). Nunca se devuelve plano.</p>
            </div>
          </div>

          <button
            onClick={saveConfig}
            disabled={savingConfig}
            className="bg-gradient-to-br from-[#ff007c] to-[#ff8017] text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-2"
          >
            {savingConfig ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Guardar configuración
          </button>
        </div>
      )}

      {tab === 'mappings' && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <p className="text-sm text-gray-500 mb-4">Definí qué evento de Meta se dispara cuando un lead pasa a cada etapa.</p>

          <div className="space-y-2">
            {mappings.map((m, i) => (
              <div key={i} className="flex items-center gap-2 border border-gray-100 rounded-xl p-2">
                <select
                  value={m.stage_key}
                  onChange={e => {
                    const next = [...mappings]; next[i] = { ...m, stage_key: e.target.value }; setMappings(next)
                  }}
                  className={`${inputCls} flex-1`}
                >
                  {STAGE_KEYS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                </select>
                <span className="text-gray-300">→</span>
                <input
                  list="meta-events"
                  value={m.meta_event_name}
                  onChange={e => {
                    const next = [...mappings]; next[i] = { ...m, meta_event_name: e.target.value }; setMappings(next)
                  }}
                  placeholder="Lead"
                  className={`${inputCls} flex-1`}
                />
                <label className="flex items-center gap-1 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={m.enabled}
                    onChange={e => {
                      const next = [...mappings]; next[i] = { ...m, enabled: e.target.checked }; setMappings(next)
                    }}
                    className="w-4 h-4 accent-[#ff007c]"
                  />
                  Activo
                </label>
                <button
                  onClick={() => deleteMapping(m)}
                  className="text-red-400 hover:text-red-600 p-1.5"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          <datalist id="meta-events">
            {META_EVENT_SUGGESTIONS.map(e => <option key={e} value={e} />)}
          </datalist>

          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={() => setMappings([...mappings, { stage_key: 'calificado', meta_event_name: 'Lead', enabled: true }])}
              className="flex items-center gap-1 text-xs text-[#ff007c] font-medium hover:underline"
            >
              <Plus className="w-3 h-3" /> Agregar mapeo
            </button>
          </div>

          <button
            onClick={saveMappings}
            disabled={savingMappings}
            className="mt-4 bg-gradient-to-br from-[#ff007c] to-[#ff8017] text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-2"
          >
            {savingMappings ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Guardar mapeos
          </button>
        </div>
      )}

      {tab === 'log' && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-700">Últimos 50 eventos</h2>
            <button
              onClick={() => setShowTestModal(true)}
              className="flex items-center gap-1.5 bg-gradient-to-br from-[#ff007c] to-[#ff8017] text-white text-xs font-medium px-3 py-1.5 rounded-lg hover:opacity-90"
            >
              <Send className="w-3 h-3" /> Probar evento
            </button>
          </div>

          {log.length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-8">Sin eventos registrados todavía</p>
          ) : (
            <div className="space-y-1.5">
              {log.map(e => (
                <div key={e.id} className="flex items-center justify-between border border-gray-100 rounded-lg px-3 py-2 text-xs">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${
                      e.status === 'sent' ? 'bg-green-100 text-green-700' :
                      e.status === 'failed' ? 'bg-red-100 text-red-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {e.status}
                    </span>
                    <span className="font-medium text-gray-800 whitespace-nowrap">{e.event_name}</span>
                    {e.lead_id && (
                      <Link href={`/leads/${e.lead_id}`} className="text-[#ff007c] hover:underline truncate">
                        {e.lead_id.slice(0, 8)}…
                      </Link>
                    )}
                    {e.last_error && (
                      <span className="text-red-500 truncate" title={e.last_error}>
                        {e.last_error.slice(0, 40)}
                      </span>
                    )}
                  </div>
                  <span className="text-gray-400 whitespace-nowrap">
                    {(e.sent_at || e.created_at) ? new Date(e.sent_at || e.created_at!).toLocaleString('es-AR') : '—'}
                    {e.attempts ? ` · ${e.attempts} intentos` : ''}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showTestModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowTestModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-[#ff007c] to-[#ff8017] h-1.5" />
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Probar evento</h3>
              <label className={labelCls}>Etapa a simular</label>
              <select value={testStage} onChange={e => setTestStage(e.target.value)} className={`${inputCls} mb-3`}>
                {STAGE_KEYS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
              <button
                onClick={runTestEvent}
                disabled={testRunning}
                className="w-full bg-gradient-to-br from-[#ff007c] to-[#ff8017] text-white py-2 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 inline-flex items-center justify-center gap-2"
              >
                {testRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Disparar evento de prueba
              </button>

              {testResult && (
                <pre className="mt-4 bg-gray-50 border border-gray-200 rounded-lg p-3 text-[10px] overflow-x-auto max-h-48">
                  {JSON.stringify(testResult, null, 2)}
                </pre>
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
        <p className="font-medium mb-1">📊 Cómo se ve para visitantes</p>
        <p className="text-blue-800">
          El script de Google Tag Manager se inyecta automáticamente en tus páginas públicas
          (<code className="bg-white px-1 rounded">/r/&lt;slug&gt;</code>, <code className="bg-white px-1 rounded">/t/&lt;slug&gt;</code>,
          {' '}<code className="bg-white px-1 rounded">/v/&lt;slug&gt;</code>, <code className="bg-white px-1 rounded">/l/&lt;slug&gt;</code>)
          cuando configures tu Container ID arriba.
        </p>
      </div>
    </div>
  )
}
