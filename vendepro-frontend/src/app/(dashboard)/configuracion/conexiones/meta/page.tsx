'use client'

import { useState, useEffect, type ReactNode } from 'react'
import { ArrowLeft, Instagram, Facebook, Copy } from 'lucide-react'
import { apiFetch, getApiBase } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { useCurrentUser } from '@/lib/use-current-user'
import { canManageOrg } from '@/lib/crm-config'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Input'
import { Switch } from '@/components/ui/Switch'
import { Heading, Text } from '@/components/ui/Typography'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { IconMedallion } from '@/components/ui/IconMedallion'
import { Alert } from '@/components/ui/Alert'
import { EmptyState } from '@/components/ui/EmptyState'

/**
 * Conectar Instagram y Facebook Messenger a la bandeja.
 *
 * Por ahora se pega el id de la cuenta y el page access token que da el panel
 * de Meta. El botón "Continuar con Facebook" (OAuth) necesita la app de Meta
 * aprobada; cuando esté, reemplaza estos formularios y guarda lo mismo.
 */

type Canal = 'instagram' | 'facebook'

interface Conexion {
  configurado: boolean
  enabled?: boolean
  account_id?: string | null
  tiene_token?: boolean
}

const CANALES: Array<{ canal: Canal; titulo: string; cuenta: string; ayuda: string; icono: ReactNode }> = [
  {
    canal: 'facebook',
    titulo: 'Facebook Messenger',
    cuenta: 'Id de la página de Facebook',
    ayuda: 'Los mensajes que le escriben a la página de la inmobiliaria.',
    icono: <Facebook className="w-5 h-5" />,
  },
  {
    canal: 'instagram',
    titulo: 'Instagram',
    cuenta: 'Id de la cuenta de Instagram profesional',
    ayuda: 'Los mensajes directos de la cuenta de Instagram de la inmobiliaria.',
    icono: <Instagram className="w-5 h-5" />,
  },
]

export default function ConexionMetaPage() {
  const { user, listo } = useCurrentUser()
  const webhook = `${getApiBase('public')}/public/inbox/meta`

  if (!listo) return <Text tone="muted">Cargando…</Text>
  if (!user || !canManageOrg(user.role)) {
    return <EmptyState title="Acceso restringido" description="Sólo un admin conecta los canales de la inmobiliaria." />
  }

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div>
        <Button href="/configuracion/conexiones" variant="ghost" icon={<ArrowLeft className="w-4 h-4" />} className="mb-4 px-0">
          Volver a Integraciones
        </Button>
        <PageHeader
          title="Instagram y Messenger"
          subtitle="Los mensajes de Instagram y de la página de Facebook entran a la bandeja de Conversaciones, junto con WhatsApp."
        />
      </div>

      <Alert tone="info" title="Antes de conectar">
        <Text size="sm">
          En la app de Meta, suscribí el webhook a los eventos <strong>messages</strong> de la página (y de Instagram)
          con esta URL. Meta firma cada aviso; el token de verificación lo tiene configurado la plataforma.
        </Text>
        <div className="flex items-center gap-2 mt-2">
          <code className="text-xs bg-white rounded-control px-2 py-1 border border-gray-200 truncate">{webhook}</code>
          <CopiarBoton texto={webhook} />
        </div>
      </Alert>

      {CANALES.map(c => <TarjetaCanal key={c.canal} {...c} />)}
    </div>
  )
}

function CopiarBoton({ texto }: { texto: string }) {
  const { toast } = useToast()
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Copiar URL"
      icon={<Copy className="w-4 h-4" />}
      onClick={() => navigator.clipboard.writeText(texto).then(() => toast('Copiado'), () => toast('No se pudo copiar', 'error'))}
    />
  )
}

function TarjetaCanal({ canal, titulo, cuenta, ayuda, icono }: (typeof CANALES)[number]) {
  const { toast } = useToast()
  const [conexion, setConexion] = useState<Conexion | null>(null)
  const [cuentaId, setCuentaId] = useState('')
  const [token, setToken] = useState('')
  const [activo, setActivo] = useState(true)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    apiFetch('crm', `/integrations/meta/${canal}`)
      .then(r => r.json() as Promise<Conexion>)
      .then(d => {
        setConexion(d)
        setCuentaId(d.account_id ?? '')
        setActivo(d.enabled !== false)
      })
      .catch(() => setConexion({ configurado: false }))
  }, [canal])

  const guardar = async () => {
    setGuardando(true)
    try {
      const res = await apiFetch('crm', `/integrations/meta/${canal}`, {
        method: 'PUT',
        body: JSON.stringify({ account_id: cuentaId.trim(), page_access_token: token.trim() || undefined, enabled: activo }),
      })
      const d = (await res.json()) as any
      if (!res.ok) { toast(d?.error ?? 'No se pudo guardar', 'error'); return }
      toast(`${titulo} conectado`)
      setToken('')
      setConexion({ configurado: true, enabled: activo, account_id: cuentaId.trim(), tiene_token: true })
    } catch { toast('Error de conexión', 'error') }
    finally { setGuardando(false) }
  }

  const conectado = !!conexion?.configurado && conexion.enabled !== false

  return (
    <Card className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <IconMedallion tone="info">{icono}</IconMedallion>
          <div className="min-w-0">
            <Heading level={4}>{titulo}</Heading>
            <Text size="sm" tone="muted">{ayuda}</Text>
          </div>
        </div>
        {conexion && (
          <StatusBadge
            label={conectado ? 'Conectado' : conexion.configurado ? 'Pausado' : 'Sin conectar'}
            color={conectado ? 'bg-success/10 text-success' : 'bg-gray-100 text-gray-600'}
          />
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={cuenta} hint="Un número largo; está en la configuración de la página en Meta.">
          <Input inputMode="numeric" value={cuentaId} onChange={e => setCuentaId(e.target.value)} placeholder="1234567890" />
        </Field>
        <Field
          label="Page access token"
          hint={conexion?.tiene_token ? 'Ya hay uno guardado. Dejalo vacío para no cambiarlo.' : 'El token de larga duración de la página.'}
        >
          <Input type="password" autoComplete="off" value={token} onChange={e => setToken(e.target.value)} placeholder={conexion?.tiene_token ? '••••••••' : 'EAAG…'} />
        </Field>
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Switch checked={activo} onChange={setActivo} label="Recibir y responder mensajes por este canal" />
        <Button variant="outline" onClick={guardar} loading={guardando} disabled={!cuentaId.trim() || (!token.trim() && !conexion?.tiene_token)}>
          Guardar
        </Button>
      </div>
    </Card>
  )
}
