'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { MessageSquare, ArrowLeft, RefreshCw, Smartphone, AlertTriangle } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { useCurrentUser } from '@/lib/use-current-user'
import { canManageOrg } from '@/lib/crm-config'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Input'
import { Heading, Text } from '@/components/ui/Typography'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Alert } from '@/components/ui/Alert'
import { EmptyState } from '@/components/ui/EmptyState'

interface Conexion {
  configurado: boolean
  enabled?: boolean
  base_url?: string | null
  session?: string
  tiene_api_key?: boolean
}

interface Sesion {
  estado: string
  cuenta?: string | null
  qr?: string | null
  error?: string
}

/** Cómo se le explica a una persona en qué anda la conexión. */
const ESTADOS: Record<string, { label: string; color: string; ayuda: string }> = {
  WORKING: {
    label: 'Conectado', color: 'bg-success/10 text-success',
    ayuda: 'El número está vinculado. Los mensajes entrantes ya caen en Conversaciones.',
  },
  SCAN_QR_CODE: {
    label: 'Esperando el QR', color: 'bg-warning/10 text-warning',
    ayuda: 'Escaneá el código con el teléfono del número que querés conectar.',
  },
  STARTING: {
    label: 'Iniciando', color: 'bg-info/10 text-info',
    ayuda: 'El proveedor está levantando la sesión. Esperá unos segundos.',
  },
  STOPPED: {
    label: 'Sin iniciar', color: 'bg-gray-100 text-gray-600',
    ayuda: 'La sesión todavía no arrancó. Tocá "Conectar" para empezar.',
  },
  FAILED: {
    label: 'Falló', color: 'bg-danger/10 text-danger',
    ayuda: 'La sesión se cayó. Volvé a conectar y escaneá de nuevo.',
  },
  ERROR: {
    label: 'Sin respuesta', color: 'bg-danger/10 text-danger',
    ayuda: 'No se pudo hablar con el proveedor. Revisá la URL y que esté levantado.',
  },
}

export default function ConexionWhatsAppPage() {
  const { toast } = useToast()
  const { user, listo } = useCurrentUser()
  const [conexion, setConexion] = useState<Conexion | null>(null)
  const [sesion, setSesion] = useState<Sesion | null>(null)
  const [form, setForm] = useState({ base_url: '', session: 'default', api_key: '' })
  const [guardando, setGuardando] = useState(false)
  const [conectando, setConectando] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const cargarConexion = useCallback(async () => {
    try {
      const d = (await (await apiFetch('crm', '/integrations/whatsapp')).json()) as Conexion
      setConexion(d)
      if (d.configurado) setForm(f => ({ ...f, base_url: d.base_url ?? '', session: d.session ?? 'default' }))
    } catch { setConexion({ configurado: false }) }
  }, [])

  const mirarSesion = useCallback(async () => {
    try {
      const res = await apiFetch('crm', '/integrations/whatsapp/session')
      setSesion((await res.json()) as Sesion)
    } catch {
      setSesion({ estado: 'ERROR', error: 'No se pudo consultar la sesión' })
    }
  }, [])

  useEffect(() => { cargarConexion() }, [cargarConexion])
  useEffect(() => { if (conexion?.configurado) mirarSesion() }, [conexion?.configurado, mirarSesion])

  // El QR caduca en segundos y cambia solo: mientras haya que escanear, se
  // vuelve a pedir. Al conectar, se deja de molestar al proveedor.
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current)
    if (!conexion?.configurado) return
    const estado = sesion?.estado
    if (estado === 'SCAN_QR_CODE' || estado === 'STARTING') {
      timer.current = setTimeout(mirarSesion, 8000)
    }
    return () => { if (timer.current) clearTimeout(timer.current) }
  }, [sesion, conexion?.configurado, mirarSesion])

  const guardar = async () => {
    if (!form.base_url.trim()) return
    setGuardando(true)
    try {
      const res = await apiFetch('crm', '/integrations/whatsapp', {
        method: 'PUT',
        body: JSON.stringify({
          base_url: form.base_url.trim(),
          session: form.session.trim() || 'default',
          ...(form.api_key ? { api_key: form.api_key } : {}),
        }),
      })
      const d = (await res.json()) as any
      if (!res.ok) toast(d?.error ?? 'No se pudo guardar', 'error')
      else {
        toast('Conexión guardada')
        setForm(f => ({ ...f, api_key: '' }))
        await cargarConexion()
        mirarSesion()
      }
    } catch { toast('Error de conexión', 'error') }
    setGuardando(false)
  }

  const conectar = async () => {
    setConectando(true)
    try {
      const res = await apiFetch('crm', '/integrations/whatsapp/session/start', { method: 'POST' })
      const d = (await res.json()) as any
      if (!res.ok) toast(d?.error ?? 'No se pudo iniciar', 'error')
      else setTimeout(mirarSesion, 1500)
    } catch { toast('Error de conexión', 'error') }
    setConectando(false)
  }

  if (!listo) return <Card><Text tone="muted">Cargando…</Text></Card>
  if (!user || !canManageOrg(user.role)) {
    return (
      <EmptyState
        icon={<MessageSquare className="w-6 h-6" />}
        title="Sólo para administradores"
        description="Conectar el WhatsApp de la inmobiliaria lo hace un administrador."
      />
    )
  }

  const estadoCfg = ESTADOS[sesion?.estado ?? ''] ?? null

  return (
    <div className="space-y-4">
      <Button href="/configuracion/conexiones" variant="ghost" icon={<ArrowLeft className="w-4 h-4" />} className="px-0">
        Volver a Conexiones
      </Button>

      <PageHeader title="WhatsApp" subtitle="El número por el que la inmobiliaria conversa con sus clientes" />

      <Alert tone="warning" title="Usá un número dedicado">
        Mientras se tramita el alta oficial en Meta, la conexión funciona espejando WhatsApp
        Web. Va contra los términos de WhatsApp y el número puede quedar bloqueado: conectá una
        línea aparte, no la que está en los carteles y los portales.
      </Alert>

      <Card className="space-y-4">
        <Heading level={3}>Proveedor</Heading>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="URL del proveedor" hint="Dónde corre WAHA. Ej: https://waha.tuservidor.com">
            <Input
              value={form.base_url}
              onChange={e => setForm({ ...form, base_url: e.target.value })}
              placeholder="https://waha.tuservidor.com"
            />
          </Field>
          <Field label="Sesión" hint="Si conectás un solo número, dejá 'default'.">
            <Input value={form.session} onChange={e => setForm({ ...form, session: e.target.value })} />
          </Field>
        </div>
        <Field
          label="API key"
          hint={conexion?.tiene_api_key ? 'Ya hay una guardada. Completá sólo si querés reemplazarla.' : 'La que configuraste en el proveedor.'}
        >
          <Input
            type="password"
            value={form.api_key}
            onChange={e => setForm({ ...form, api_key: e.target.value })}
            placeholder={conexion?.tiene_api_key ? '••••••••' : ''}
          />
        </Field>
        <div className="flex justify-end">
          <Button onClick={guardar} loading={guardando} disabled={!form.base_url.trim()}>Guardar</Button>
        </div>
      </Card>

      {conexion?.configurado && (
        <Card className="space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <Heading level={3}>Estado del número</Heading>
            <div className="flex items-center gap-2">
              {estadoCfg && <StatusBadge label={estadoCfg.label} color={estadoCfg.color} />}
              <Button variant="ghost" icon={<RefreshCw className="w-3.5 h-3.5" />} onClick={mirarSesion}>
                Actualizar
              </Button>
            </div>
          </div>

          {estadoCfg && <Text size="sm" tone="muted">{estadoCfg.ayuda}</Text>}
          {sesion?.error && <Alert tone="danger">{sesion.error}</Alert>}

          {sesion?.estado === 'WORKING' && sesion.cuenta && (
            <Text size="sm" className="flex items-center gap-1.5">
              <Smartphone className="w-4 h-4 text-success" /> Vinculado a <strong>{sesion.cuenta}</strong>
            </Text>
          )}

          {sesion?.qr && (
            <div className="flex flex-col items-center gap-2 py-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={sesion.qr} alt="Código QR para vincular WhatsApp" className="w-56 h-56 rounded-card border border-gray-200" />
              <Text size="xs" tone="muted">
                WhatsApp → Dispositivos vinculados → Vincular dispositivo
              </Text>
              <Text size="xs" tone="muted" className="flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> El código caduca en menos de un minuto; se renueva solo.
              </Text>
            </div>
          )}

          {(sesion?.estado === 'STOPPED' || sesion?.estado === 'FAILED') && (
            <div className="flex justify-end">
              <Button onClick={conectar} loading={conectando}>Conectar</Button>
            </div>
          )}
        </Card>
      )}
    </div>
  )
}
