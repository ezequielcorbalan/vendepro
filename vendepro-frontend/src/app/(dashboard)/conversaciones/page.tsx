'use client'

import { useState, useEffect, useCallback, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { MessageSquare, AlertTriangle } from 'lucide-react'
import { useTiempoReal } from '@/lib/tiempo-real'
import { apiFetch } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { useCurrentUser } from '@/lib/use-current-user'
import { canSeeAll, canManageOrg } from '@/lib/crm-config'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { Text } from '@/components/ui/Typography'
import { EmptyState } from '@/components/ui/EmptyState'
import { Badge } from '@/components/ui/Badge'
import { FiltrosBandeja, type Carpeta, type ConteoCarpetas } from '@/components/conversaciones/FiltrosBandeja'
import { FilaConversacion } from '@/components/conversaciones/FilaConversacion'
import { EncabezadoConversacion } from '@/components/conversaciones/EncabezadoConversacion'
import { HiloMensajes } from '@/components/conversaciones/HiloMensajes'
import { Compositor } from '@/components/conversaciones/Compositor'
import type { Conversation, Message } from '@/components/conversaciones/tipos'

// useSearchParams obliga a un límite de Suspense para el prerender.
export default function ConversacionesPage() {
  return (
    <Suspense fallback={null}>
      <Bandeja />
    </Suspense>
  )
}

function Bandeja() {
  const { toast } = useToast()
  const [filtro, setFiltro] = useState<'open' | 'resolved'>('open')
  const [conversaciones, setConversaciones] = useState<Conversation[]>([])
  const [activa, setActiva] = useState<Conversation | null>(null)
  const [mensajes, setMensajes] = useState<Message[]>([])
  const [agentes, setAgentes] = useState<any[]>([])
  const [texto, setTexto] = useState('')
  const [cargando, setCargando] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const { user } = useCurrentUser()
  // Delegar es repartir: admin, owner y supervisor. El servidor lo exige igual;
  // esto sólo evita mostrar un selector que va a responder 403.
  const reparte = !!user && canSeeAll(user.role)
  const activaId = useRef<string | null>(null)
  activaId.current = activa?.id ?? null

  // Carpetas y filtros. Quien reparte arranca en "Todas" (es lo que veía
  // antes); un agente tiene sólo las suyas y el servidor lo exige igual.
  const [carpeta, setCarpeta] = useState<Carpeta>('todas')
  const [busqueda, setBusqueda] = useState('')
  const [busquedaAplicada, setBusquedaAplicada] = useState('')
  const [canal, setCanal] = useState('')
  const [etiqueta, setEtiqueta] = useState('')
  const [conteos, setConteos] = useState<ConteoCarpetas>({})
  const [etiquetasOrg, setEtiquetasOrg] = useState<string[]>([])

  // La búsqueda pega contra D1 (nombre, teléfono y texto de los mensajes): se
  // espera a que el usuario deje de tipear.
  useEffect(() => {
    const t = setTimeout(() => setBusquedaAplicada(busqueda.trim()), 300)
    return () => clearTimeout(t)
  }, [busqueda])

  const cargarCarpetas = useCallback(() => {
    apiFetch('crm', '/conversations/carpetas')
      .then(r => r.json() as Promise<any>)
      .then(d => {
        setConteos(d?.carpetas ?? {})
        setEtiquetasOrg(Array.isArray(d?.etiquetas) ? d.etiquetas : [])
      })
      .catch(() => {})
  }, [])

  const cargarBandeja = useCallback(() => {
    const params = new URLSearchParams({ status: filtro, carpeta })
    if (busquedaAplicada) params.set('q', busquedaAplicada)
    if (canal) params.set('channel', canal)
    if (etiqueta) params.set('label', etiqueta)
    apiFetch('crm', `/conversations?${params}`)
      .then(r => r.json() as Promise<any>)
      .then(d => {
        const lista = Array.isArray(d) ? d : []
        setConversaciones(lista)
        setCargando(false)
      })
      .catch(() => setCargando(false))
    cargarCarpetas()
  }, [filtro, carpeta, busquedaAplicada, canal, etiqueta, cargarCarpetas])

  useEffect(() => { setCargando(true); cargarBandeja() }, [cargarBandeja])

  const recargarHilo = useCallback(() => {
    const id = activaId.current
    if (!id) return
    apiFetch('crm', `/conversations/${id}/messages`)
      .then(r => r.json() as Promise<any>)
      .then(d => { if (Array.isArray(d) && activaId.current === id) setMensajes(d) })
      .catch(() => {})
  }, [])

  // En vivo: cada cambio en una conversación que puedo ver llega por el
  // WebSocket y se refresca la lista (y el hilo, si es el que tengo abierto).
  const enVivo = useTiempoReal(evento => {
    if (evento.tipo !== 'conversacion') return
    cargarBandeja()
    if (activaId.current === evento.conversationId) recargarHilo()
  })

  // Respaldo por si la conexión en vivo se cae: cada 15 s sin ella, cada
  // minuto con ella (por si se perdió algún aviso).
  useEffect(() => {
    const intervalo = setInterval(() => {
      if (document.hidden) return
      cargarBandeja()
      recargarHilo()
    }, enVivo ? 60_000 : 15_000)
    return () => clearInterval(intervalo)
  }, [cargarBandeja, recargarHilo, enVivo])

  // El aviso de la campana trae `?c=<id>`: se abre esa conversación apenas
  // carga la bandeja, y también si ya estabas acá y tocás otro aviso.
  const pedida = useSearchParams().get('c')
  const ultimaPedida = useRef<string | null>(null)
  useEffect(() => {
    if (!pedida || cargando || ultimaPedida.current === pedida) return
    const c = conversaciones.find(x => x.id === pedida)
    if (!c) return
    ultimaPedida.current = pedida
    abrir(c)
  }, [pedida, cargando, conversaciones])

  useEffect(() => {
    apiFetch('admin', '/agents').then(r => r.json() as Promise<any>)
      .then(d => { if (Array.isArray(d)) setAgentes(d) }).catch(() => {})
  }, [])

  const abrir = async (c: Conversation) => {
    setActiva(c)
    setMensajes([])
    try {
      const res = await apiFetch('crm', `/conversations/${c.id}/messages`)
      const d = (await res.json()) as any
      setMensajes(Array.isArray(d) ? d : [])
    } catch { setMensajes([]) }
  }

  const enviar = async () => {
    if (!activa || !texto.trim()) return
    setEnviando(true)
    try {
      const res = await apiFetch('crm', `/conversations/${activa.id}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content: texto.trim() }),
      })
      const d = (await res.json()) as any
      if (!res.ok) {
        // 409 = la org no tiene WhatsApp conectado; el resto, error del proveedor.
        toast(d?.error ?? 'No se pudo enviar', 'error')
      } else {
        setTexto('')
        abrir(activa)
        cargarBandeja()
      }
    } catch { toast('Error de conexión', 'error') }
    setEnviando(false)
  }

  const asignar = async (agentId: string) => {
    if (!activa) return
    try {
      await apiFetch('crm', `/conversations/${activa.id}/assignments`, {
        method: 'POST',
        body: JSON.stringify({ assignee_id: agentId || null }),
      })
      toast(agentId ? 'Conversación delegada' : 'Devuelta a la cola')
      cargarBandeja()
      setActiva({ ...activa, assignee_id: agentId || null })
    } catch { toast('No se pudo asignar', 'error') }
  }

  const cambiarEtiquetas = async (labels: string[]) => {
    if (!activa) return
    const previas = activa.labels
    setActiva({ ...activa, labels })
    try {
      const res = await apiFetch('crm', `/conversations/${activa.id}/labels`, {
        method: 'POST',
        body: JSON.stringify({ labels }),
      })
      const d = (await res.json()) as any
      if (!res.ok) throw new Error(d?.error)
      setActiva(a => a && a.id === activa.id ? { ...a, labels: d.labels } : a)
      cargarBandeja()
    } catch {
      setActiva(a => a && a.id === activa.id ? { ...a, labels: previas } : a)
      toast('No se pudieron guardar las etiquetas', 'error')
    }
  }

  const alternarEstado = async () => {
    if (!activa) return
    try {
      const res = await apiFetch('crm', `/conversations/${activa.id}/toggle_status`, { method: 'POST' })
      const d = (await res.json()) as any
      setActiva({ ...activa, status: d.status })
      cargarBandeja()
    } catch { toast('No se pudo cambiar el estado', 'error') }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Conversaciones"
        subtitle="WhatsApp, Instagram y Messenger de la inmobiliaria, atados a los contactos del CRM"
        actions={
          <div className="flex items-center gap-3">
          {enVivo && <Badge tone="success" dot>En vivo</Badge>}
          <SegmentedControl
            value={filtro}
            onChange={v => { setFiltro(v as 'open' | 'resolved'); setActiva(null) }}
            options={[{ value: 'open', label: 'Abiertas' }, { value: 'resolved', label: 'Resueltas' }]}
          />
          </div>
        }
      />

      {/* ds-todo: candidato a variante "split view" (lista + detalle) — se repite
          en conversaciones y podría servir al calendario. */}
      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4">
        <Card padded={false} className="overflow-hidden max-h-[70vh] flex flex-col">
          <FiltrosBandeja
            reparte={reparte}
            carpeta={carpeta}
            onCarpeta={c => { setCarpeta(c); setActiva(null) }}
            conteos={conteos}
            busqueda={busqueda}
            onBusqueda={setBusqueda}
            canal={canal}
            onCanal={setCanal}
            etiqueta={etiqueta}
            onEtiqueta={setEtiqueta}
            etiquetas={etiquetasOrg}
          />
          <div className="overflow-y-auto flex-1">
            {cargando ? (
              <div className="p-4"><Text tone="muted">Cargando…</Text></div>
            ) : conversaciones.length === 0 ? (
              <EmptyState
                icon={<MessageSquare className="w-6 h-6" />}
                title="Sin conversaciones"
                description={busquedaAplicada || canal || etiqueta
                  ? 'Ninguna coincide con los filtros.'
                  : 'Cuando entre un mensaje al número conectado, aparece acá.'}
              />
            ) : (
              <div className="divide-y divide-gray-100">
                {conversaciones.map(c => (
                  <FilaConversacion key={c.id} conversacion={c} activa={activa?.id === c.id} onAbrir={() => abrir(c)} />
                ))}
              </div>
            )}
          </div>
        </Card>

        {!activa ? (
          <Card className="grid place-items-center min-h-[320px]">
            <Text tone="muted">Elegí una conversación para verla.</Text>
          </Card>
        ) : (
          <Card padded={false} className="flex flex-col max-h-[70vh]">
            <EncabezadoConversacion
              conversacion={activa}
              reparte={reparte}
              usuarioId={user?.id ?? null}
              agentes={agentes}
              etiquetasOrg={etiquetasOrg}
              onAsignar={asignar}
              onAlternarEstado={alternarEstado}
              onCambiarEtiquetas={cambiarEtiquetas}
            />
            <HiloMensajes mensajes={mensajes} />
            <Compositor
              canal={activa.channel}
              ventanaAbierta={activa.window_open}
              nombreContacto={activa.contact_name}
              direccion={activa.lead?.address}
              texto={texto}
              onTexto={setTexto}
              onEnviar={enviar}
              enviando={enviando}
              puedeConfigurar={!!user && canManageOrg(user.role)}
            />
          </Card>
        )}
      </div>

      <Text size="xs" tone="muted" className="flex items-center gap-1.5">
        <AlertTriangle className="w-3 h-3" />
        WhatsApp usa un proveedor no oficial mientras se tramita el alta en Meta; Instagram y Messenger van por la API oficial.
      </Text>
    </div>
  )
}
