'use client'

import { useEffect, useState } from 'react'
import { FileCheck2, Loader2 } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Input'
import { Switch } from '@/components/ui/Switch'
import { Text } from '@/components/ui/Typography'
import { WidgetHeader } from '@/components/ui/WidgetHeader'
import { useToast } from '@/components/ui/Toast'

type VpUser = { id: string; full_name?: string; email?: string }

/**
 * Configuración del portal de documentación (/d/<token>): a qué webhook de n8n
 * se mandan los archivos y con qué apodo identifica n8n a cada agente.
 * Sólo admin (lo valida también el backend).
 */
export default function DocsIntegrationCard() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [enabled, setEnabled] = useState(false)
  const [uploadUrl, setUploadUrl] = useState('')
  const [doneUrl, setDoneUrl] = useState('')
  const [agentMap, setAgentMap] = useState<Record<string, string>>({})
  const [users, setUsers] = useState<VpUser[]>([])

  useEffect(() => {
    Promise.all([
      apiFetch('properties', '/doc-portal/settings').then(r => r.json() as Promise<any>).catch(() => null),
      apiFetch('admin', '/agents').then(r => r.json() as Promise<any>).catch(() => []),
    ]).then(([cfg, agents]) => {
      setEnabled(!!cfg?.enabled)
      setUploadUrl(cfg?.upload_url ?? '')
      setDoneUrl(cfg?.done_url ?? '')
      setAgentMap(cfg?.agent_map && typeof cfg.agent_map === 'object' ? cfg.agent_map : {})
      setUsers(Array.isArray(agents) ? agents : [])
      setLoading(false)
    })
  }, [])

  async function save() {
    setSaving(true)
    try {
      const res = await apiFetch('properties', '/doc-portal/settings', {
        method: 'PUT',
        body: JSON.stringify({ enabled, upload_url: uploadUrl, done_url: doneUrl, agent_map: agentMap }),
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
      <WidgetHeader
        icon={<FileCheck2 className="w-4 h-4" />}
        title="Documentación de propiedades (n8n)"
        subtitle="El propietario sube los papeles desde un link y se guardan en Drive, clasificados con IA."
        action={!loading ? <Switch checked={enabled} onChange={setEnabled} label="Activa" /> : undefined}
      />

      {loading ? (
        <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
      ) : (
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

          <div className="flex justify-end">
            <Button variant="outline" loading={saving} onClick={save}>Guardar</Button>
          </div>
        </>
      )}
    </Card>
  )
}
