'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  Plug, ArrowLeft, Loader2, Save, CheckCircle2, XCircle,
  RefreshCw, Download, Radio, AlertCircle, History, Calendar, Unplug, Users, Sparkles,
} from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Heading, Text } from '@/components/ui/Typography'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select } from '@/components/ui/Input'
import { Switch } from '@/components/ui/Switch'
import { Checkbox } from '@/components/ui/Choice'
import { Alert } from '@/components/ui/Alert'
import { EmptyState } from '@/components/ui/EmptyState'
import { getCurrentUser } from '@/lib/auth'
import type { CrmIntegration, GoogleIntegration, IntegrationSyncLogEntry } from '@/lib/types'

type KpAgent = { external_id: string; full_name: string; email: string | null }
type VpUser = { id: string; full_name?: string; email?: string; role?: string }

const KEY_PLACEHOLDER = '********'

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

  // Google Calendar (personal del usuario logueado)
  const [google, setGoogle] = useState<GoogleIntegration | null>(null)
  const [googleBusy, setGoogleBusy] = useState(false)

  // Form
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [showKeyInput, setShowKeyInput] = useState(false)
  const [enabled, setEnabled] = useState(false)
  const [createBuyerLeads, setCreateBuyerLeads] = useState(true)
  const [saving, setSaving] = useState(false)

  // Acciones
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; profileName?: string | null; error?: string } | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [backfilling, setBackfilling] = useState(false)
  const [backfillProgress, setBackfillProgress] = useState<{ created: number; skipped: number } | null>(null)

  // Mapeo de agentes + re-procesar consultas
  const [kpAgents, setKpAgents] = useState<KpAgent[]>([])
  const [vpUsers, setVpUsers] = useState<VpUser[]>([])
  const [agentMap, setAgentMap] = useState<Record<string, string>>({})
  const [savingMap, setSavingMap] = useState(false)
  const [enriching, setEnriching] = useState(false)
  const [enrichProgress, setEnrichProgress] = useState<{ created: number; enriched: number } | null>(null)

  const loadAgents = useCallback(async () => {
    try {
      const [agentsRes, usersRes] = await Promise.all([
        apiFetch('crm', '/integrations/kiteprop/agents').then(r => r.json() as Promise<any>).catch(() => null),
        apiFetch('admin', '/agents').then(r => r.json() as Promise<any>).catch(() => []),
      ])
      setKpAgents(Array.isArray(agentsRes?.kiteprop) ? agentsRes.kiteprop : [])
      setAgentMap(agentsRes?.map && typeof agentsRes.map === 'object' ? agentsRes.map : {})
      setVpUsers(Array.isArray(usersRes) ? usersRes : [])
    } catch { /* sección vacía si falla */ }
  }, [])

  const loadAll = useCallback(async () => {
    try {
      const [cfg, logData] = await Promise.all([
        apiFetch('crm', '/integrations/kiteprop').then(r => r.json() as Promise<any>).catch(() => null),
        apiFetch('crm', '/integrations/kiteprop/log').then(r => r.json() as Promise<any>).catch(() => []),
      ])
      setIntegration(cfg && cfg.id ? cfg : null)
      setEnabled(!!cfg?.enabled)
      try {
        const config = cfg?.config_json ? JSON.parse(cfg.config_json) : {}
        setCreateBuyerLeads(config?.create_buyer_leads !== false)
      } catch { setCreateBuyerLeads(true) }
      setLog(Array.isArray(logData) ? logData : [])
    } catch { /* estado de error implícito: integration null */ }
    setLoading(false)
  }, [])

  const loadGoogle = useCallback(async () => {
    try {
      const res = await apiFetch('crm', '/integrations/google')
      const data = (await res.json()) as any
      setGoogle(res.ok ? data : null)
    } catch { setGoogle(null) }
  }, [])

  useEffect(() => {
    loadGoogle()
    if (!isAdmin) { setLoading(false); return }
    loadAll()
  }, [isAdmin, loadAll, loadGoogle])

  // Cargar agentes cuando ya hay API key configurada.
  useEffect(() => {
    if (isAdmin && integration?.has_api_key) loadAgents()
  }, [isAdmin, integration?.has_api_key, loadAgents])

  async function handleSaveAgentMap() {
    setSavingMap(true)
    try {
      const res = await apiFetch('crm', '/integrations/kiteprop/agent-map', {
        method: 'PUT',
        body: JSON.stringify({ map: agentMap }),
      })
      const data = (await res.json()) as any
      if (!res.ok || !data.ok) throw new Error()
      setAgentMap(data.map ?? agentMap)
      toast('Mapeo de agentes guardado')
    } catch {
      toast('Error guardando el mapeo', 'error')
    }
    setSavingMap(false)
  }

  async function handleEnrich() {
    if (!confirm('¿Re-procesar las consultas históricas? Se re-asigna el agente mapeado y se trae la propiedad consultada a los contactos ya importados. Puede tomar varios minutos.')) return
    setEnriching(true)
    setEnrichProgress({ created: 0, enriched: 0 })
    try {
      let done = false, created = 0, enriched = 0, guard = 0
      while (!done && guard < 200) {
        guard++
        const res = await apiFetch('crm', '/integrations/kiteprop/enrich', { method: 'POST' })
        const data = (await res.json()) as any
        if (!data.ok) { toast(data.error || 'Se interrumpió; volvé a intentar para retomar', 'error'); break }
        created += data.created ?? 0
        enriched += data.enriched ?? 0
        setEnrichProgress({ created, enriched })
        done = !!data.done
        if (data.error) { toast(`Parcial: ${data.error}. Volvé a intentar para retomar.`, 'warning'); break }
      }
      if (done) toast(`Consultas re-procesadas: ${created} nuevos, ${enriched} enriquecidos`)
      await loadAll()
    } catch {
      toast('Error de conexión', 'error')
    }
    setEnriching(false)
  }

  // Al volver del consentimiento de Google llega ?google=ok|error.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const status = params.get('google')
    if (!status) return
    if (status === 'ok') toast('Google Calendar conectado')
    else toast(`No se pudo conectar Google Calendar${params.get('reason') ? ` (${params.get('reason')})` : ''}`, 'error')
    window.history.replaceState(null, '', window.location.pathname)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleGoogleConnect() {
    setGoogleBusy(true)
    try {
      const res = await apiFetch('crm', '/integrations/google/auth-url')
      const data = (await res.json()) as any
      if (!res.ok || !data.url) throw new Error(data?.error)
      window.location.href = data.url
      return // el flujo sigue en Google y vuelve por redirect
    } catch (err: any) {
      toast(err?.message || 'No se pudo iniciar la conexión con Google', 'error')
    }
    setGoogleBusy(false)
  }

  async function handleGoogleDisconnect() {
    if (!confirm('¿Desconectar tu Google Calendar? Los eventos ya copiados no se borran.')) return
    setGoogleBusy(true)
    try {
      const res = await apiFetch('crm', '/integrations/google', { method: 'DELETE' })
      if (!res.ok) throw new Error()
      toast('Google Calendar desconectado')
      await loadGoogle()
    } catch {
      toast('Error al desconectar', 'error')
    }
    setGoogleBusy(false)
  }

  async function handleGoogleToggle(enabled: boolean) {
    setGoogle(g => g ? { ...g, enabled } : g)
    try {
      const res = await apiFetch('crm', '/integrations/google', {
        method: 'PUT',
        body: JSON.stringify({ enabled }),
      })
      if (!res.ok) throw new Error()
      toast(enabled ? 'Sincronización activada' : 'Sincronización pausada')
    } catch {
      toast('No se pudo actualizar', 'error')
      await loadGoogle()
    }
  }

  async function handleSave() {
    setSaving(true)
    try {
      const body: any = { enabled, create_buyer_leads: createBuyerLeads }
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

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
  }

  const hasKey = !!integration?.has_api_key

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {/* Header */}
      <div>
        <Link href="/configuracion" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-ink mb-4">
          <ArrowLeft className="w-4 h-4" /> Volver a Configuración
        </Link>
        <PageHeader
          title="Integraciones"
          subtitle="Conectá tu Google Calendar personal y gestioná la importación automática de contactos al CRM."
        />
      </div>

      {/* Google Calendar (personal del usuario) */}
      <Card className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {/* Identidad de tercero (Google): tile rojo intencional */}
            <div className="w-10 h-10 rounded-control bg-red-50 text-red-500 flex items-center justify-center">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <Text weight="semibold">Google Calendar</Text>
              <Text size="xs" tone="muted">
                {google?.connected
                  ? <>Conectado{google.email ? <> como <span className="font-medium">{google.email}</span></> : ''} · tus eventos del CRM se copian a tu calendar</>
                  : 'Copiá automáticamente tus eventos del CRM (visitas, reuniones, tasaciones) a tu calendar personal'}
              </Text>
            </div>
          </div>
          {google?.connected && (
            <Switch
              checked={google.enabled}
              onChange={handleGoogleToggle}
              label="Activa"
              className="shrink-0"
            />
          )}
        </div>

        {google && !google.configured && (
          <Alert tone="warning">
            Falta configurar las credenciales de Google en el servidor (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET).
          </Alert>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {google?.connected ? (
            <Button
              variant="outline"
              onClick={handleGoogleDisconnect}
              loading={googleBusy}
              icon={<Unplug className="w-4 h-4" />}
            >
              Desconectar
            </Button>
          ) : (
            <Button
              onClick={handleGoogleConnect}
              loading={googleBusy}
              disabled={!google?.configured}
              icon={<Calendar className="w-4 h-4" />}
            >
              Conectar con Google
            </Button>
          )}
        </div>
        <Text size="xs" tone="muted">
          La conexión es personal: cada agente conecta su propia cuenta. Se piden permisos sólo sobre eventos de calendario.
        </Text>
      </Card>

      {isAdmin && (<>
      {/* Integración de contactos (provider interno: kiteprop) */}
      <Card className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-control bg-primary/10 text-primary flex items-center justify-center">
              <Plug className="w-5 h-5" />
            </div>
            <div>
              <Text weight="semibold">Importación de contactos</Text>
              <Text size="xs" tone="muted">Trae los contactos nuevos al CRM · Último sync {fmtDate(integration?.last_sync_at ?? null)}</Text>
            </div>
          </div>
          <Checkbox
            checked={enabled}
            onChange={setEnabled}
            label="Activa"
            className="shrink-0"
          />
        </div>

        {/* Leads compradores automáticos por consulta de portal */}
        <div className="flex items-center justify-between gap-3 mt-3 pt-3 border-t border-gray-100">
          <div>
            <Text weight="medium" className="text-gray-700">Leads compradores automáticos</Text>
            <Text size="xs" tone="muted">
              Cada consulta de portal crea un lead en el pipeline de Compradores con la propiedad
              consultada vinculada (se importa como propiedad local si no existe). Guardá para aplicar.
            </Text>
          </div>
          <Checkbox
            checked={createBuyerLeads}
            onChange={setCreateBuyerLeads}
            label="Activo"
            className="shrink-0"
          />
        </div>

        {/* API Key */}
        <Field label="API Key" hint="Se guarda cifrada y nunca se muestra de nuevo.">
          {hasKey && !showKeyInput ? (
            <div className="flex items-center justify-between bg-success/10 border border-success/30 rounded-control px-3 py-2">
              <span className="text-sm text-ink flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-success" /> API Key guardada
              </span>
              <button
                type="button"
                onClick={() => { setShowKeyInput(true); setApiKeyInput('') }}
                className="text-xs text-primary hover:underline font-medium"
              >
                Cambiar
              </button>
            </div>
          ) : (
            <Input
              type="password"
              value={apiKeyInput}
              onChange={e => setApiKeyInput(e.target.value)}
              placeholder={hasKey ? KEY_PLACEHOLDER : 'kp_...'}
            />
          )}
        </Field>

        {/* Resultado de prueba */}
        {testResult && (
          <Alert tone={testResult.ok ? 'success' : 'danger'}>
            {testResult.ok
              ? <>Conexión OK{testResult.profileName ? ` — cuenta de ${testResult.profileName}` : ''}</>
              : <>{testResult.error || 'La conexión falló'}</>}
          </Alert>
        )}

        {/* Acciones */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Button
            onClick={handleSave}
            loading={saving}
            icon={<Save className="w-4 h-4" />}
          >
            Guardar
          </Button>
          <Button
            variant="outline"
            onClick={handleTest}
            loading={testing}
            disabled={!hasKey && !apiKeyInput.trim()}
            icon={<Radio className="w-4 h-4" />}
          >
            Probar conexión
          </Button>
          <Button
            variant="outline"
            onClick={handleSync}
            loading={syncing}
            disabled={!hasKey || !integration?.enabled}
            title={!integration?.enabled ? 'Activá y guardá la integración primero' : undefined}
            icon={<RefreshCw className="w-4 h-4" />}
          >
            Sincronizar ahora
          </Button>
          <Button
            variant="outline"
            onClick={handleBackfill}
            loading={backfilling}
            disabled={!hasKey || !integration?.enabled}
            title={!integration?.enabled ? 'Activá y guardá la integración primero' : undefined}
            icon={<Download className="w-4 h-4" />}
          >
            Importar histórico
          </Button>
        </div>

        {backfilling && backfillProgress && (
          <Alert tone="warning" hideIcon className="items-center">
            <span className="flex items-center gap-3">
              <Loader2 className="w-4 h-4 animate-spin text-warning shrink-0" />
              <span>
                Importando histórico… <strong>{backfillProgress.created}</strong> creados, {backfillProgress.skipped} omitidos.
              </span>
            </span>
          </Alert>
        )}
      </Card>

      {/* Mapeo de agentes */}
      {hasKey && (
        <Card className="space-y-4">
          <div>
            <Heading level={4} className="flex items-center gap-2">
              <Users className="w-4 h-4 text-gray-400" /> Agentes
            </Heading>
            <Text size="xs" tone="muted" className="mt-1">
              Asigná cada agente de KiteProp a un usuario de VendéPro. Los leads nuevos se asignan al usuario mapeado; usá <em>Re-procesar consultas</em> para re-atribuir los ya importados.
            </Text>
          </div>

          {kpAgents.length === 0 ? (
            <Text tone="muted">No se pudieron cargar los agentes de KiteProp.</Text>
          ) : (
            <div className="divide-y divide-gray-50">
              {kpAgents.map(a => (
                <div key={a.external_id} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <Text weight="medium" className="truncate">{a.full_name}</Text>
                    {a.email && <Text size="xs" tone="muted" className="truncate">{a.email}</Text>}
                  </div>
                  <Select
                    value={agentMap[a.external_id] ?? ''}
                    onChange={e => setAgentMap(m => ({ ...m, [a.external_id]: e.target.value }))}
                    className="w-auto shrink-0 px-2.5 py-1.5 max-w-[55%]"
                  >
                    <option value="">— sin asignar —</option>
                    {vpUsers.map(u => (
                      <option key={u.id} value={u.id}>{u.full_name || u.email || u.id}</option>
                    ))}
                  </Select>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button
              onClick={handleSaveAgentMap}
              loading={savingMap}
              disabled={kpAgents.length === 0}
              icon={<Save className="w-4 h-4" />}
            >
              Guardar mapeo
            </Button>
            <Button
              variant="outline"
              onClick={handleEnrich}
              loading={enriching}
              disabled={!integration?.enabled}
              title={!integration?.enabled ? 'Activá y guardá la integración primero' : undefined}
              icon={<Sparkles className="w-4 h-4" />}
            >
              Re-procesar consultas
            </Button>
          </div>

          {enriching && enrichProgress && (
            <Alert tone="warning" hideIcon className="items-center">
              <span className="flex items-center gap-3">
                <Loader2 className="w-4 h-4 animate-spin text-warning shrink-0" />
                <span>
                  Re-procesando consultas… <strong>{enrichProgress.enriched}</strong> enriquecidos, {enrichProgress.created} nuevos.
                </span>
              </span>
            </Alert>
          )}
        </Card>
      )}

      {/* Log de sincronizaciones */}
      <Card>
        <Heading level={4} className="flex items-center gap-2 mb-3">
          <History className="w-4 h-4 text-gray-400" /> Últimas sincronizaciones
        </Heading>
        {log.length === 0 ? (
          <EmptyState
            icon={<AlertCircle className="w-6 h-6" />}
            title="Sin sincronizaciones todavía."
          />
        ) : (
          <ul className="divide-y divide-gray-50">
            {log.map(entry => (
              <li key={entry.id} className="flex items-center gap-2 py-2 text-xs">
                {entry.status === 'ok'
                  ? <CheckCircle2 className="w-3.5 h-3.5 text-success shrink-0" />
                  : entry.status === 'partial'
                    ? <AlertCircle className="w-3.5 h-3.5 text-warning shrink-0" />
                    : <XCircle className="w-3.5 h-3.5 text-danger shrink-0" />}
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
      </Card>
      </>)}
    </div>
  )
}
