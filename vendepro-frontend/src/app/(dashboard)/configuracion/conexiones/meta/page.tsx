'use client'

import { useState, useEffect, useCallback } from 'react'
import { ArrowLeft, Facebook, CheckCircle2 } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { useCurrentUser } from '@/lib/use-current-user'
import { canManageOrg } from '@/lib/crm-config'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Input'
import { RadioGroup } from '@/components/ui/Choice'
import { Heading, Text } from '@/components/ui/Typography'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Alert } from '@/components/ui/Alert'
import { EmptyState } from '@/components/ui/EmptyState'

interface Conexion {
  configurado: boolean
  enabled?: boolean
  page_id?: string | null
  page_name?: string | null
  tiene_token?: boolean
  lead_owner_name?: string | null
}

interface Pagina { id: string; name: string }

export default function ConexionMetaPage() {
  const { toast } = useToast()
  const { user, listo } = useCurrentUser()
  const [conexion, setConexion] = useState<Conexion | null>(null)
  const [token, setToken] = useState('')
  const [paginas, setPaginas] = useState<Pagina[] | null>(null)
  const [elegida, setElegida] = useState('')
  const [conectando, setConectando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    try {
      setConexion((await (await apiFetch('crm', '/integrations/meta')).json()) as Conexion)
    } catch { setConexion({ configurado: false }) }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  /** Primer toque: si el token ve una sola página la conecta; si ve varias, pide elegir. */
  const conectar = async () => {
    setConectando(true)
    setError(null)
    try {
      const res = await apiFetch('crm', '/integrations/meta/connect', {
        method: 'POST',
        body: JSON.stringify({ token: token.trim(), ...(elegida ? { page_id: elegida } : {}) }),
      })
      const d = (await res.json()) as any
      if (!res.ok) {
        setError(d?.error ?? 'No se pudo conectar con Meta')
      } else if (d.status === 'elegir') {
        setPaginas(d.pages)
        setElegida(d.pages[0]?.id ?? '')
      } else {
        toast(`Página "${d.page.name}" conectada`)
        setToken('')
        setPaginas(null)
        setElegida('')
        await cargar()
      }
    } catch { setError('Error de conexión') }
    setConectando(false)
  }

  if (!listo) return <Card><Text tone="muted">Cargando…</Text></Card>
  if (!user || !canManageOrg(user.role)) {
    return (
      <EmptyState
        icon={<Facebook className="w-6 h-6" />}
        title="Sólo para administradores"
        description="Conectar la página de Facebook de la inmobiliaria lo hace un administrador."
      />
    )
  }

  const conectada = !!conexion?.configurado && !!conexion.page_id && !!conexion.tiene_token

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <Button href="/configuracion/conexiones" variant="ghost" icon={<ArrowLeft className="w-4 h-4" />} className="px-0">
        Volver a Conexiones
      </Button>

      <PageHeader
        title="Facebook e Instagram"
        subtitle="Los formularios de tus anuncios entran solos como leads al CRM"
      />

      <Card className="space-y-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <Heading level={3}>Página de Facebook</Heading>
            <Text size="sm" tone="muted">
              Cada formulario que alguien completa en un anuncio de Facebook o Instagram crea un lead
              en etapa Nuevo, asignado a quien conectó la página, con la campaña como origen.
            </Text>
          </div>
          <StatusBadge
            label={conectada ? 'Conectada' : 'Sin conectar'}
            color={conectada ? 'bg-success/10 text-success' : 'bg-gray-100 text-gray-600'}
          />
        </div>

        {conectada && (
          <Text size="sm" className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-success" />
            Conectada a <strong>{conexion?.page_name ?? conexion?.page_id}</strong>
          </Text>
        )}
        {conectada && (
          <Text size="sm" tone="muted">
            Los leads nuevos se asignan a{' '}
            <strong>{conexion?.lead_owner_name ?? 'el primer administrador'}</strong>.
            Para recibirlos vos, reconectá la página con tu usuario.
          </Text>
        )}

        <Field
          label={conectada ? 'Reemplazar el token' : 'Token del usuario del sistema'}
          hint="Business Manager → Usuarios del sistema → Generar token, con leads_retrieval, pages_show_list, pages_read_engagement, pages_manage_metadata y ads_read. Sólo se usa para sacar el de la página; no se guarda."
        >
          <Input
            type="password"
            value={token}
            onChange={e => { setToken(e.target.value); setPaginas(null); setElegida('') }}
            placeholder={conectada ? '••••••••' : 'EAA…'}
            autoComplete="off"
          />
        </Field>

        {paginas && (
          <Field label="¿Qué página conectás?">
            <RadioGroup
              name="pagina-meta"
              options={paginas.map(p => ({ value: p.id, label: p.name }))}
              value={elegida}
              onChange={setElegida}
            />
          </Field>
        )}

        {error && <Alert tone="danger">{error}</Alert>}

        <div className="flex justify-end">
          <Button onClick={conectar} loading={conectando} disabled={!token.trim() || (!!paginas && !elegida)}>
            {paginas ? 'Conectar esta página' : conectada ? 'Reconectar' : 'Conectar página'}
          </Button>
        </div>
      </Card>
    </div>
  )
}
