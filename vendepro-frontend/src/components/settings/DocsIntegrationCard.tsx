'use client'

import { useEffect, useState } from 'react'
import { ExternalLink, FileCheck2, HardDrive, Loader2, Unplug } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Alert } from '@/components/ui/Alert'
import { Field, Input } from '@/components/ui/Input'
import { Switch } from '@/components/ui/Switch'
import { Text } from '@/components/ui/Typography'
import { WidgetHeader } from '@/components/ui/WidgetHeader'
import { PillRadioGroup } from '@/components/ui/ChoicePills'
import { useToast } from '@/components/ui/Toast'
import { useConfirm } from '@/components/ui/useConfirm'

type VpUser = { id: string; full_name?: string; email?: string }
type Engine = 'google_drive' | 'n8n'
interface DriveStatus { connected: boolean; email: string | null; root_folder_url: string | null; configured?: boolean }

const ENGINE_OPTIONS = [
  { value: 'google_drive', label: 'Google Drive de la inmobiliaria' },
  { value: 'n8n', label: 'n8n (avanzado)' },
]

/**
 * Configuración del portal de documentación (/d/<token>): dónde quedan los
 * archivos que manda el propietario. Por defecto, el Google Drive de la
 * inmobiliaria (VendéPro clasifica y guarda solo); n8n para quien ya tiene
 * su propio workflow. Sólo admin (lo valida también el backend).
 */
export default function DocsIntegrationCard() {
  const { toast } = useToast()
  const { confirmDialog, askConfirm } = useConfirm()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [enabled, setEnabled] = useState(false)
  const [engine, setEngine] = useState<Engine>('google_drive')
  const [uploadUrl, setUploadUrl] = useState('')
  const [doneUrl, setDoneUrl] = useState('')
  const [agentMap, setAgentMap] = useState<Record<string, string>>({})
  const [users, setUsers] = useState<VpUser[]>([])
  const [drive, setDrive] = useState<DriveStatus>({ connected: false, email: null, root_folder_url: null })

  async function load() {
    const [cfg, agents, driveStatus] = await Promise.all([
      apiFetch('properties', '/doc-portal/settings').then(r => r.json() as Promise<any>).catch(() => null),
      apiFetch('admin', '/agents').then(r => r.json() as Promise<any>).catch(() => []),
      apiFetch('crm', '/integrations/google-drive').then(r => r.json() as Promise<any>).catch(() => null),
    ])
    setEnabled(!!cfg?.enabled)
    setEngine(cfg?.engine === 'n8n' ? 'n8n' : 'google_drive')
    setUploadUrl(cfg?.upload_url ?? '')
    setDoneUrl(cfg?.done_url ?? '')
    setAgentMap(cfg?.agent_map && typeof cfg.agent_map === 'object' ? cfg.agent_map : {})
    setUsers(Array.isArray(agents) ? agents : [])
    if (driveStatus && typeof driveStatus.connected === 'boolean') setDrive(driveStatus)
    setLoading(false)
  }

  useEffect(() => {
    load()
    // Vuelta del consentimiento de Google: ?drive=ok|error&reason=…
    const params = new URLSearchParams(window.location.search)
    const result = params.get('drive')
    if (result) {
      if (result === 'ok') toast('Google Drive conectado')
      else toast(`No se pudo conectar el Drive: ${params.get('reason') ?? 'error'}`, 'error')
      params.delete('drive')
      params.delete('reason')
      const qs = params.toString()
      window.history.replaceState(null, '', `${window.location.pathname}${qs ? `?${qs}` : ''}`)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function connectDrive() {
    setConnecting(true)
    try {
      const res = await apiFetch('crm', '/integrations/google-drive/auth-url')
      const j = (await res.json()) as any
      if (!res.ok || !j?.url) throw new Error(j?.error || 'No se pudo iniciar la conexión')
      window.location.href = j.url
    } catch (err) {
      toast((err as Error).message, 'error')
      setConnecting(false)
    }
  }

  async function disconnectDrive() {
    const { confirmed } = await askConfirm({
      title: 'Desconectar Google Drive',
      message: 'Los propietarios no van a poder subir documentos hasta que lo vuelvas a conectar. Los archivos que ya están en el Drive no se tocan.',
      confirmLabel: 'Desconectar',
      variant: 'danger',
    })
    if (!confirmed) return
    const res = await apiFetch('crm', '/integrations/google-drive', { method: 'DELETE' })
    if (res.ok) {
      setDrive({ connected: false, email: null, root_folder_url: null })
      if (engine === 'google_drive') setEnabled(false)
      toast('Drive desconectado')
    } else toast('No se pudo desconectar', 'error')
  }

  async function save() {
    setSaving(true)
    try {
      const res = await apiFetch('properties', '/doc-portal/settings', {
        method: 'PUT',
        body: JSON.stringify({ enabled, engine, upload_url: uploadUrl, done_url: doneUrl, agent_map: agentMap }),
      })
      const j = (await res.json()) as any
      if (!res.ok) throw new Error(j?.error || 'No se pudo guardar')
      setEnabled(!!j.enabled)
      toast('Configuración guardada')
    } catch (err) {
      toast((err as Error).message, 'error')
    }
    setSaving(false)
  }

  return (
    <Card className="space-y-4">
      {confirmDialog}
      <WidgetHeader
        icon={<FileCheck2 className="w-4 h-4" />}
        title="Documentación de propiedades"
        subtitle="El propietario sube o escanea los papeles desde un link; se guardan clasificados con IA."
        action={!loading ? <Switch checked={enabled} onChange={setEnabled} label="Activa" /> : undefined}
      />

      {loading ? (
        <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
      ) : (
        <>
          <PillRadioGroup
            label="¿Dónde se guardan los archivos?"
            size="sm"
            options={ENGINE_OPTIONS}
            value={engine}
            onChange={v => setEngine(v as Engine)}
          />

          {engine === 'google_drive' && (
            <div className="space-y-3">
              {drive.connected ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="success" dot>Conectado</Badge>
                  {drive.email && <Text size="sm">{drive.email}</Text>}
                  <div className="flex gap-2 ml-auto">
                    {drive.root_folder_url && (
                      <Button href={drive.root_folder_url} target="_blank" rel="noopener noreferrer" variant="outline" size="sm"
                        icon={<ExternalLink className="w-3.5 h-3.5" />}>
                        Abrir carpeta
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" icon={<Unplug className="w-3.5 h-3.5" />} className="text-danger" onClick={disconnectDrive}>
                      Desconectar
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <Text size="sm" tone="muted">
                    VendéPro crea en el Drive la carpeta “VendéPro — Documentación”, con una carpeta por propiedad. Sólo puede ver y tocar lo que crea él: el resto del Drive queda fuera de su alcance.
                  </Text>
                  <Button variant="outline" loading={connecting} icon={<HardDrive className="w-4 h-4" />} onClick={connectDrive}>
                    Conectar Google Drive
                  </Button>
                  {drive.configured === false && (
                    <Alert tone="warning">
                      El servidor todavía no tiene las credenciales de Google. Hay que cargar GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET.
                    </Alert>
                  )}
                </>
              )}
            </div>
          )}

          {engine === 'n8n' && (
            <>
              <Field label="URL de subida" hint="Webhook documentacion-subir del workflow de n8n">
                <Input type="url" value={uploadUrl} onChange={e => setUploadUrl(e.target.value)} placeholder="https://…/webhook/documentacion-subir" />
              </Field>
              <Field label="URL de cierre" hint="Webhook documentacion-listo: dispara el resumen por mail">
                <Input type="url" value={doneUrl} onChange={e => setDoneUrl(e.target.value)} placeholder="https://…/webhook/documentacion-listo" />
              </Field>

              {users.length > 0 && (
                <div className="space-y-2">
                  <Text size="sm" weight="medium">Agente en n8n</Text>
                  <Text size="xs" tone="muted">
                    El apodo con el que n8n elige la carpeta y a quién avisar (andres, danila, oficina…). Vacío = lo decide n8n con su planilla.
                  </Text>
                  {users.map(u => (
                    <div key={u.id} className="flex items-center gap-3">
                      <Text size="sm" className="flex-1 min-w-0 truncate">{u.full_name || u.email || u.id}</Text>
                      <Input
                        value={agentMap[u.id] ?? ''}
                        onChange={e => setAgentMap(m => ({ ...m, [u.id]: e.target.value }))}
                        placeholder="oficina"
                        className="w-40"
                        aria-label={`Apodo en n8n de ${u.full_name || u.email}`}
                      />
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          <div className="flex justify-end">
            <Button variant="outline" loading={saving} onClick={save}>Guardar</Button>
          </div>
        </>
      )}
    </Card>
  )
}
