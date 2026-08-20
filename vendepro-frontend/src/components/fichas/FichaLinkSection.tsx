'use client'

import { useCallback, useEffect, useState } from 'react'
import { Link2, Copy, Check, Archive, ArchiveRestore, Loader2 } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Heading, Text } from '@/components/ui/Typography'
import { EmptyState } from '@/components/ui/EmptyState'
import { WhatsAppButton } from '@/components/ui/ContactButtons'
import { useToast } from '@/components/ui/Toast'
import { formatDate } from '@/lib/utils'

interface FichaLink {
  id: string
  mode: 'single' | 'open'
  slug: string
  label: string | null
  lead_id: string | null
  active: boolean
  submissions_count: number
  last_submitted_at: string | null
  archived_at: string | null
  created_at: string
  public_url: string
}

function absoluteUrl(publicUrl: string): string {
  if (typeof window === 'undefined') return publicUrl
  return `${window.location.origin}${publicUrl}`
}

/**
 * Links públicos de Ficha de Tasación.
 *
 * - `mode="single"` (con leadId): link para UN propietario, pre-llenado con lo
 *   que el CRM ya sabe del lead. Se consume con el primer envío.
 * - `mode="open"`: link permanente para publicar. Cada envío entra como lead
 *   nuevo con su ficha y su tasación en borrador.
 */
export function FichaLinkSection({
  mode,
  leadId,
  ownerPhone,
  className,
}: {
  mode: 'single' | 'open'
  leadId?: string
  /** Habilita el botón de mandar el link por WhatsApp. */
  ownerPhone?: string | null
  className?: string
}) {
  const { toast } = useToast()
  const [links, setLinks] = useState<FichaLink[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(() => {
    const qs = new URLSearchParams({ mode })
    if (leadId) qs.set('lead_id', leadId)
    setLoading(true)
    apiFetch('properties', `/ficha-links?${qs.toString()}`)
      .then(async r => {
        const body = (await r.json()) as any
        setLinks(Array.isArray(body) ? body : [])
      })
      .catch(() => setLinks([]))
      .finally(() => setLoading(false))
  }, [mode, leadId])

  useEffect(() => { load() }, [load])

  async function generate() {
    setGenerating(true)
    try {
      const res = await apiFetch('properties', '/ficha-links', {
        method: 'POST',
        body: JSON.stringify({ mode, lead_id: leadId ?? null }),
      })
      const body = (await res.json()) as any
      if (!res.ok) throw new Error(body?.error || 'No se pudo generar el link')
      // Copiamos de una: el 100% de las veces el paso siguiente es pegarlo.
      await navigator.clipboard.writeText(absoluteUrl(body.public_url)).catch(() => {})
      toast(body.reused ? 'Ya tenías un link abierto — copiado' : 'Link generado y copiado', 'success')
      load()
    } catch (e: any) {
      toast(e?.message || 'No se pudo generar el link', 'error')
    } finally {
      setGenerating(false)
    }
  }

  async function copy(link: FichaLink) {
    try {
      await navigator.clipboard.writeText(absoluteUrl(link.public_url))
      setCopiedId(link.id)
      setTimeout(() => setCopiedId(null), 2000)
    } catch {
      toast('No se pudo copiar', 'error')
    }
  }

  async function toggleArchive(link: FichaLink) {
    setBusyId(link.id)
    try {
      await apiFetch('properties', `/ficha-links/${link.id}/archive`, {
        method: 'PATCH',
        body: JSON.stringify({ archived: !link.archived_at }),
      })
      toast(link.archived_at ? 'Link reactivado' : 'Link archivado', 'success')
      load()
    } catch {
      toast('No se pudo actualizar el link', 'error')
    } finally {
      setBusyId(null)
    }
  }

  const isOpen = mode === 'open'
  const title = isOpen ? 'Link público de tasación' : 'Ficha para el propietario'
  const description = isOpen
    ? 'Un link permanente para poner en la bio de Instagram, la firma del mail o un flyer. Cada persona que lo complete entra como lead nuevo con la ficha cargada.'
    : 'Mandale el link al propietario para que complete los datos de la propiedad antes de la visita. Llega pre-llenado con lo que ya sabemos.'

  return (
    <Card className={className}>
      <div className="flex items-start justify-between gap-3 mb-1">
        <Heading level={4} className="flex items-center gap-2">
          <Link2 className="w-4 h-4 text-gray-600" /> {title}
        </Heading>
        <Button
          size="sm"
          onClick={generate}
          loading={generating}
          icon={<Link2 className="w-3.5 h-3.5" />}
        >
          {isOpen ? 'Obtener link' : 'Generar link'}
        </Button>
      </div>
      <Text size="xs" tone="muted">{description}</Text>

      <div className="mt-4">
        {loading ? (
          <div className="flex items-center gap-2 py-4">
            <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
            <Text size="xs" tone="muted">Cargando…</Text>
          </div>
        ) : links.length === 0 ? (
          <EmptyState
            icon={<Link2 className="w-6 h-6" />}
            title="Todavía no hay link"
            description={isOpen ? 'Generá uno y publicalo donde te encuentren.' : 'Generá uno y mandáselo por WhatsApp.'}
          />
        ) : (
          <div className="space-y-2">
            {links.map(link => {
              const url = absoluteUrl(link.public_url)
              const used = link.mode === 'single' && link.submissions_count > 0
              return (
                <div
                  key={link.id}
                  className="flex flex-wrap items-center gap-2 p-3 rounded-control border border-gray-100 hover:bg-gray-50"
                >
                  <div className="flex-1 min-w-0">
                    <Text size="xs" className="font-mono truncate">{url}</Text>
                    <Text size="xs" tone="muted">
                      {link.archived_at
                        ? 'Archivado'
                        : used
                          ? `Completado el ${formatDate(link.last_submitted_at!)}`
                          : link.submissions_count > 0
                            ? `${link.submissions_count} fichas recibidas · última ${formatDate(link.last_submitted_at!)}`
                            : `Creado el ${formatDate(link.created_at)} · sin completar`}
                    </Text>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copy(link)}
                    icon={copiedId === link.id
                      ? <Check className="w-3.5 h-3.5 text-success" />
                      : <Copy className="w-3.5 h-3.5" />}
                  >
                    {copiedId === link.id ? 'Copiado' : 'Copiar'}
                  </Button>

                  {ownerPhone && !link.archived_at && !used && (
                    <WhatsAppButton
                      phone={ownerPhone}
                      message={`Hola! Te paso el link para que completes los datos de tu propiedad antes de la tasación: ${url}`}
                      iconOnly
                    />
                  )}

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleArchive(link)}
                    loading={busyId === link.id}
                    icon={link.archived_at
                      ? <ArchiveRestore className="w-3.5 h-3.5" />
                      : <Archive className="w-3.5 h-3.5" />}
                  >
                    {link.archived_at ? 'Reactivar' : 'Archivar'}
                  </Button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </Card>
  )
}
