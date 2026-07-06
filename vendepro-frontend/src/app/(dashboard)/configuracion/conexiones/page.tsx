'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  Plug, ArrowLeft, Loader2, Save, CheckCircle2, XCircle, ShieldAlert,
  RefreshCw, Download, Radio, AlertCircle, History,
} from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { getCurrentUser } from '@/lib/auth'
import type { CrmIntegration, IntegrationSyncLogEntry } from '@/lib/types'

const KEY_PLACEHOLDER = '********'

const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-pink/50 focus:border-brand-pink'
const labelCls = 'block text-sm font-medium text-gray-700 mb-1'

const KIND_LABELS: Record<string, string> = {
  auto: 'Automático', manual: 'Manual', backfill: 'Histórico', test: 'Prueba',
}

const fmtDate = (s: string | null) =>
  s ? new Date(s.replace(' ', 'T')).toLocaleString('es-AR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'

export default function ConexionesPage() {
  const { toast } = useToast()
  const user = getCurrentUser()
  const isAdmin = user?.role === 'admin' || user?.role === 'owner'

  const [loading, setLoading] = useState(true)
  const [integration, setIntegration] = useState<CrmIntegration | null>(null)
  const [log, setLog] = useState<IntegrationSyncLogEntry[]>([])

  // Form
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [showKeyInput, setShowKeyInput] = useState(false)
  const [enabled, setEnabled] = useState(false)
  const [saving, setSaving] = useState(false)

  // Acciones
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; profileName?: string | null; error?: string } | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [backfilling, setBackfilling] = useState(false)
  const [backfillProgress, setBackfillProgress] = useState<{ created: number; skipped: number } | null>(null)

  const loadAll = useCallback(async () => {
    try {
      const [cfg, logData] = await Promise.all([
        apiFetch('crm', '/integrations/kiteprop').then(r => r.json() as Promise<any>).catch(() => null),
        apiFetch('crm', '/integrations/kiteprop/log').then(r => r.json() as Promise<any>).catch(() => []),
      ])
      setIntegration(cfg && cfg.id ? cfg : null)
      setEnabled(!!cfg?.enabled)
      setLog(Array.isArray(logData) ? logData : [])
    } catch { /* estado de error implícito: integration null */ }
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!isAdmin) { setLoading(false); return }
    loadAll()
  }, [isAdmin, loadAll])

  async function handleSave() {
    setSaving(true)
    try {
      const body: any = { enabled }
      if (apiKeyInput.trim()) body.api_key = apiKeyInput.trim()
      const res = await apiFetch('crm', '/integrations/kiteprop', {
        method: 'PUT',
        body: JSON.stringify(body),
      })
      const data = (await res.json()) as any
      if (!res.ok) throw new Error(data?.error)
      setIntegration(data)
      setEnabled(!!data.enabled)
      setApiKeyInput('')
      setShowKeyInput(false)
      setTestResult(null)
      toast('Configuración guardada')
    } catch {
      toast('Error guardando la configuración', 'error')
    }
    setSaving(false)
  }

  async function handleTest() {
    setTesting(true)
    setTestResult(null)
    try {
      const body: any = {}
      if (apiKeyInput.trim()) body.api_key = apiKeyInput.trim()
      const res = await apiFetch('crm', '/integrations/kiteprop/test', {
        method: 'POST',
        body: JSON.stringify(body),
      })
      setTestResult((await res.json()) as any)
    } catch {
      setTestResult({ ok: false, error: 'Error de conexión' })
    }
    setTesting(false)
  }

  async function handleSync() {
    setSyncing(true)
    try {
      const res = await apiFetch('crm', '/integrations/kiteprop/sync', { method: 'POST' })
      const data = (await res.json()) as any
      if (data.ok) {
        const parts = [`${data.created ?? 0} nuevos`]
        if (data.enriched) parts.push(`${data.enriched} enriquecidos`)
        parts.push(`${data.skipped ?? 0} sin cambios`)
        toast(`Sincronizado: ${parts.join(', ')}`)
      } else {
        toast(data.error || 'No se pudo sincronizar', 'error')
      }
      await loadAll()
    } catch {
      toast('Error de conexión', 'error')
    }
    setSyncing(false)
  }

  async function handleBackfill() {
    if (!confirm('¿Importar el histórico completo de contactos? Se crean sólo contactos (no leads) y los repetidos se omiten. Puede tomar varios minutos.')) return
    setBackfilling(true)
    setBackfillProgress({ created: 0, skipped: 0 })
    try {
      // Chunked: el backend procesa de a tandas; repetimos hasta done:true.
      let done = false
      let created = 0
      let skipped = 0
      let guard = 0
      while (!done && guard < 60) {
        guard++
        const res = await apiFetch('crm', '/integrations/kiteprop/backfill', { method: 'POST' })
        const data = (await res.json()) as any
        if (!data.ok) {
          toast(data.error || 'El histórico se interrumpió; volvé a intentar para retomar', 'error')
          break
        }
        created += data.created ?? 0
        skipped += data.skipped ?? 0
        setBackfillProgress({ created, skipped })
        done = !!data.done
        if (data.error) {
          toast(`Importación parcial: ${data.error}. Volvé a intentar para retomar.`, 'warning')
          break
        }
      }
      if (done) toast(`Histórico importado: ${created} contactos nuevos, ${skipped} omitidos`)
      await loadAll()
    } catch {
      toast('Error de conexión', 'error')
    }
    setBackfilling(false)
  }

  if (!isAdmin) {
    return (
      <div className="max-w-2xl mx-auto text-center py-16">
        <ShieldAlert className="w-10 h-10 text-amber-500 mx-auto mb-3" />
        <p className="text-gray-800 font-medium">Acceso restringido</p>
        <p className="text-sm text-gray-500 mt-1">Sólo administradores pueden gestionar conexiones.</p>
        <Link href="/configuracion" className="inline-flex items-center gap-2 text-sm text-brand-pink mt-4">
          <ArrowLeft className="w-4 h-4" /> Volver a Configuración
        </Link>
      </div>
    )
  }

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
  }

  const hasKey = !!integration?.has_api_key

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {/* Header */}
      <div>
        <Link href="/configuracion" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 mb-4">
          <ArrowLeft className="w-4 h-4" /> Volver a Configuración
        </Link>
        <h1 className="text-xl sm:text-2xl font-semibold text-gray-800 flex items-center gap-2">
          <Plug className="w-6 h-6 text-brand-pink" /> Integraciones
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Los contactos nuevos se importan automáticamente al CRM cada 15 minutos.
        </p>
      </div>

      {/* Integración de contactos (provider interno: kiteprop) */}
      <div className="bg-white rounded-xl border p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-pink-50 text-brand-pink flex items-center justify-center">
              <Plug className="w-5 h-5" />
            </div>
            <div>
              <p className="font-semibold text-gray-800">Importación de contactos</p>
              <p className="text-xs text-gray-500">Trae los contactos nuevos al CRM · Último sync {fmtDate(integration?.last_sync_at ?? null)}</p>
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer shrink-0">
            <input
              type="checkbox"
              checked={enabled}
              onChange={e => setEnabled(e.target.checked)}
              className="w-4 h-4 accent-[#ff007c]"
            />
            <span className="text-sm font-medium text-gray-700">Activa</span>
          </label>
        </div>

        {/* API Key */}
        <div>
          <label className={labelCls}>API Key</label>
          {hasKey && !showKeyInput ? (
            <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg px-3 py-2">
              <span className="text-sm text-green-700 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" /> API Key guardada
              </span>
              <button
                type="button"
                onClick={() => { setShowKeyInput(true); setApiKeyInput('') }}
                className="text-xs text-brand-pink hover:underline font-medium"
              >
                Cambiar
              </button>
            </div>
          ) : (
            <input
              type="password"
              value={apiKeyInput}
              onChange={e => setApiKeyInput(e.target.value)}
              placeholder={hasKey ? KEY_PLACEHOLDER : 'kp_...'}
              className={inputCls}
            />
          )}
          <p className="text-[11px] text-gray-400 mt-1">
            Se guarda cifrada y nunca se muestra de nuevo.
          </p>
        </div>

        {/* Resultado de prueba */}
        {testResult && (
          <div className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
            testResult.ok ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-700'
          }`}>
            {testResult.ok
              ? <><CheckCircle2 className="w-4 h-4 shrink-0" /> Conexión OK{testResult.profileName ? ` — cuenta de ${testResult.profileName}` : ''}</>
              : <><XCircle className="w-4 h-4 shrink-0" /> {testResult.error || 'La conexión falló'}</>}
          </div>
        )}

        {/* Acciones */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 bg-brand-pink text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Guardar
          </button>
          <button
            onClick={handleTest}
            disabled={testing || (!hasKey && !apiKeyInput.trim())}
            className="flex items-center gap-2 border border-gray-300 text-gray-700 px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
          >
            {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Radio className="w-4 h-4" />}
            Probar conexión
          </button>
          <button
            onClick={handleSync}
            disabled={syncing || !hasKey || !integration?.enabled}
            title={!integration?.enabled ? 'Activá y guardá la integración primero' : undefined}
            className="flex items-center gap-2 border border-gray-300 text-gray-700 px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
          >
            {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Sincronizar ahora
          </button>
          <button
            onClick={handleBackfill}
            disabled={backfilling || !hasKey || !integration?.enabled}
            title={!integration?.enabled ? 'Activá y guardá la integración primero' : undefined}
            className="flex items-center gap-2 border border-gray-300 text-gray-700 px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
          >
            {backfilling ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Importar histórico
          </button>
        </div>

        {backfilling && backfillProgress && (
          <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
            <Loader2 className="w-4 h-4 animate-spin text-amber-500 shrink-0" />
            <p className="text-sm text-amber-800">
              Importando histórico… <strong>{backfillProgress.created}</strong> creados, {backfillProgress.skipped} omitidos.
            </p>
          </div>
        )}
      </div>

      {/* Log de sincronizaciones */}
      <div className="bg-white rounded-xl border p-5">
        <p className="font-semibold text-gray-800 flex items-center gap-2 mb-3">
          <History className="w-4 h-4 text-gray-400" /> Últimas sincronizaciones
        </p>
        {log.length === 0 ? (
          <div className="text-center py-6">
            <AlertCircle className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500">Sin sincronizaciones todavía.</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-50">
            {log.map(entry => (
              <li key={entry.id} className="flex items-center gap-2 py-2 text-xs">
                {entry.status === 'ok'
                  ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
                  : entry.status === 'partial'
                    ? <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    : <XCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />}
                <span className="font-medium text-gray-700">{KIND_LABELS[entry.kind] ?? entry.kind}</span>
                <span className="text-gray-500">
                  {entry.contacts_created} nuevos · {entry.contacts_skipped} omitidos
                  {entry.error ? ` · ${entry.error}` : ''}
                </span>
                <span className="ml-auto text-gray-400 tabular-nums shrink-0">{fmtDate(entry.started_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
