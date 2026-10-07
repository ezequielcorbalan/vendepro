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
    ayuda: 'Levantando la sesión. Esperá unos segundos.',
  },
  STOPPED: {
    label: 'Sin conectar', color: 'bg-gray-100 text-gray-600',
    ayuda: 'Todavía no hay ningún número vinculado.',
  },
  FAILED: {
    label: 'Se cayó', color: 'bg-danger/10 text-danger',
    ayuda: 'La sesión se desvinculó. Volvé a conectar y escaneá de nuevo.',
  },
  ERROR: {
    label: 'Sin respuesta', color: 'bg-danger/10 text-danger',
    ayuda: 'No se pudo hablar con el proveedor de WhatsApp.',
  },
}

export default function ConexionWhatsAppPage() {
  const { toast } = useToast()
  const { user, listo } = useCurrentUser()
  const [conexion, setConexion] = useState<Conexion | null>(null)
  const [sesion, setSesion] = useState<Sesion | null>(null)
  const [form, setForm] = useState({ base_url: '', session: '', api_key: '' })
  const [guardando, setGuardando] = useState(false)
  const [conectando, setConectando] = useState(false)
  const [avanzado, setAvanzado] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const cargarConexion = useCallback(async () => {
    try {
      const d = (await (await apiFetch('crm', '/integrations/whatsapp')).json()) as Conexion
      setConexion(d)
      if (d.configurado) setForm(f => ({ ...f, base_url: d.base_url ?? '', session: d.session ?? '' }))
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
  // vuelve a pedir. Una vez conectado se deja de molestar al proveedor.
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current)
    if (!conexion?.configurado) return
    const estado = sesion?.estado
    if (estado === 'SCAN_QR_CODE' || estado === 'STARTING') {
      timer.current = setTimeout(mirarSesion, 8000)
    }
    return () => { if (timer.current) clearTimeout(timer.current) }
  }, [sesion, conexion?.configurado, mirarSesion])

  /** Un solo paso: configura, crea la sesión de esta inmobiliaria y trae el QR. */
  const conectar = async () => {
    setConectando(true)
    try {
      const res = await apiFetch('crm', '/integrations/whatsapp/connect', { method: 'POST' })
      const d = (await res.json()) as any
      if (!res.ok) toast(d?.error ?? 'No se pudo conectar', 'error')
      else {
        await cargarConexion()
        setTimeout(mirarSesion, 1500)
      }
    } catch { toast('Error de conexión', 'error') }
    setConectando(false)
  }

  const guardarAvanzado = async () => {
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
        toast('Configuración guardada')
        setForm(f => ({ ...f, api_key: '' }))
        await cargarConexion()
        mirarSesion()
      }
    } catch { toast('Error de conexión', 'error') }
    setGuardando(false)
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
  const conectado = sesion?.estado === 'WORKING'
  const escaneando = sesion?.estado === 'SCAN_QR_CODE'

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
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <Heading level={3}>Conectar el número</Heading>
            <Text size="sm" tone="muted">
              Tocá conectar y escaneá el código con el teléfono del número que vas a usar.
              No hay nada que instalar.
            </Text>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {estadoCfg && <StatusBadge label={estadoCfg.label} color={estadoCfg.color} />}
            {conexion?.configurado && (
              <Button variant="ghost" icon={<RefreshCw className="w-3.5 h-3.5" />} onClick={mirarSesion}>
                Actualizar
              </Button>
            )}
          </div>
        </div>

        {estadoCfg && <Text size="sm" tone="muted">{estadoCfg.ayuda}</Text>}
        {sesion?.error && <Alert tone="danger">{sesion.error}</Alert>}

        {conectado && sesion?.cuenta && (
          <Text size="sm" className="flex items-center gap-1.5">
            <Smartphone className="w-4 h-4 text-success" /> Vinculado a <strong>{sesion.cuenta}</strong>
          </Text>
        )}

        {sesion?.qr && (
          <div className="flex flex-col items-center gap-2 py-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={sesion.qr}
              alt="Código QR para vincular WhatsApp"
              className="w-56 h-56 rounded-card border border-gray-200"
            />
            <Text size="xs" tone="muted">WhatsApp → Dispositivos vinculados → Vincular dispositivo</Text>
            <Text size="xs" tone="muted" className="flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> El código caduca en menos de un minuto; se renueva solo.
            </Text>
          </div>
        )}

        {!escaneando && (
          <div className="flex justify-end">
            <Button onClick={conectar} loading={conectando}>
              {conectado ? 'Conectar otro número' : 'Conectar WhatsApp'}
            </Button>
          </div>
        )}
      </Card>

      {/* Lo técnico, para la inmobiliaria que prefiera su propio servidor. */}
      <Card className="space-y-4">
        <Button variant="ghost" onClick={() => setAvanzado(v => !v)} className="px-0">
          {avanzado ? 'Ocultar' : 'Mostrar'} opciones avanzadas
        </Button>
        {avanzado && (
          <>
            <Text size="sm" tone="muted">
              Por defecto se usa el proveedor de VendéPro y no hay nada que configurar.
              Completá esto sólo si hospedás tu propia instancia.
            </Text>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="URL del proveedor" hint="Vacío = el de VendéPro.">
                <Input
                  value={form.base_url}
                  onChange={e => setForm({ ...form, base_url: e.target.value })}
                  placeholder="https://waha.tuservidor.com"
                />
              </Field>
              <Field label="Sesión" hint="Se asigna sola por inmobiliaria.">
                <Input value={form.session} onChange={e => setForm({ ...form, session: e.target.value })} />
              </Field>
            </div>
            <Field
              label="API key"
              hint={conexion?.tiene_api_key ? 'Ya hay una guardada. Completá sólo para reemplazarla.' : 'La de tu propia instancia.'}
            >
              <Input
                type="password"
                value={form.api_key}
                onChange={e => setForm({ ...form, api_key: e.target.value })}
                placeholder={conexion?.tiene_api_key ? '••••••••' : ''}
              />
            </Field>
            <div className="flex justify-end">
              <Button variant="outline" onClick={guardarAvanzado} loading={guardando} disabled={!form.base_url.trim()}>
                Guardar
              </Button>
            </div>
          </>
        )}
      </Card>
    </div>
  )
}
