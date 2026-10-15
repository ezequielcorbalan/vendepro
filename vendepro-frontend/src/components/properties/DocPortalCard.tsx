'use client'

import { useCallback, useEffect, useState } from 'react'
import { Copy, ExternalLink, FileText, Inbox, Loader2, RefreshCw, Send, Trash2 } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { ProgressBar } from '@/components/ui/Progress'
import { Text } from '@/components/ui/Typography'
import { WidgetHeader } from '@/components/ui/WidgetHeader'
import { PillRadioGroup } from '@/components/ui/ChoicePills'
import { WhatsAppButton } from '@/components/ui/ContactButtons'
import { useToast } from '@/components/ui/Toast'
import { useConfirm } from '@/components/ui/useConfirm'
import {
  DOC_KIND_OPTIONS,
  DOC_MARRIED_OPTIONS,
  DOC_OPERATION_OPTIONS,
  DOC_SUCCESSION_OPTIONS,
  docPortalAbsoluteUrl,
  toDocKind,
  toDocOperation,
  type PropertyDocumentsView,
} from '@/lib/doc-portal'

interface Props {
  propertyId: string
  propertyType: string | null
  operationType: string | null
  ownerName: string | null
  ownerPhone: string | null
}

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })

/**
 * Portal del propietario: genera el link /d/<token> para que el dueño suba la
 * documentación, y muestra lo que llegó (clasificado por la IA de n8n).
 */
export default function DocPortalCard({ propertyId, propertyType, operationType, ownerName, ownerPhone }: Props) {
  const { toast } = useToast()
  const { confirmDialog, askConfirm } = useConfirm()
  const [view, setView] = useState<PropertyDocumentsView | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    operation: toDocOperation(operationType) as string,
    property_kind: toDocKind(propertyType) as string,
    succession: 'no',
    married: 'nose',
  })

  const load = useCallback(async () => {
    try {
      const res = await apiFetch('properties', `/properties/${propertyId}/documents`)
      if (!res.ok) throw new Error()
      setView((await res.json()) as any)
      setError(false)
    } catch {
      setError(true)
    }
    setLoading(false)
  }, [propertyId])

  useEffect(() => { load() }, [load])

  function openModal() {
    const link = view?.link
    setForm({
      operation: link?.operation ?? toDocOperation(operationType),
      property_kind: link?.property_kind ?? toDocKind(propertyType),
      succession: link?.succession ?? 'no',
      married: link?.married === true ? 'si' : link?.married === false ? 'no' : 'nose',
    })
    setModalOpen(true)
  }

  async function generate() {
    setSaving(true)
    try {
      const res = await apiFetch('properties', `/properties/${propertyId}/doc-portal-link`, {
        method: 'POST',
        body: JSON.stringify({
          operation: form.operation,
          property_kind: form.property_kind,
          succession: form.succession,
          married: form.married === 'si' ? true : form.married === 'no' ? false : null,
        }),
      })
      const j = (await res.json()) as any
      if (!res.ok) throw new Error(j?.error || 'No se pudo generar el link')
      setModalOpen(false)
      toast('Link generado')
      await load()
    } catch (err) {
      toast((err as Error).message, 'error')
    }
    setSaving(false)
  }

  async function revoke() {
    const { confirmed } = await askConfirm({
      title: 'Desactivar el link',
      message: 'El propietario ya no va a poder subir archivos con este link. Los documentos que mandó quedan guardados.',
      confirmLabel: 'Desactivar',
      variant: 'danger',
    })
    if (!confirmed) return
    const res = await apiFetch('properties', `/properties/${propertyId}/doc-portal-link`, { method: 'DELETE' })
    if (res.ok) { toast('Link desactivado'); await load() } else toast('No se pudo desactivar', 'error')
  }

  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url)
      toast('Link copiado')
    } catch {
      toast('No se pudo copiar', 'error')
    }
  }

  if (loading) {
    return <Card className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></Card>
  }

  const link = view?.link ?? null
  const checklist = view?.checklist ?? null
  const docs = view?.documents ?? []
  const url = link ? docPortalAbsoluteUrl(link.public_url) : ''
  const pct = checklist?.required_total ? Math.round((checklist.required_done / checklist.required_total) * 100) : 0
  const firstName = (ownerName ?? '').trim().split(/\s+/)[0]
  const message = `Hola${firstName ? ` ${firstName}` : ''}! Para avanzar con la publicación necesitamos la documentación de la propiedad. Podés subirla desde acá, ves qué falta y qué ya recibimos: ${url}`

  return (
    <Card>
      {confirmDialog}
      <WidgetHeader
        icon={<Inbox className="w-4 h-4" />}
        title="Portal del propietario"
        subtitle={link ? `${link.files_count} archivo${link.files_count === 1 ? '' : 's'} por el portal` : 'El dueño sube la documentación desde un link'}
        className="mb-4"
        action={checklist ? <Text weight="bold">{pct}%</Text> : undefined}
      />

      {error && <Text size="sm" tone="danger">No se pudo cargar la documentación recibida.</Text>}

      {!error && !view?.enabled && !link && (
        <Text size="sm" tone="muted">
          La carga automática de documentación no está configurada. Un administrador la activa desde Configuración → Integraciones.
        </Text>
      )}

      {!error && view?.enabled && !link && (
        <Button variant="outline" fullWidth icon={<Send className="w-4 h-4" />} onClick={openModal}>
          Pedir documentación al propietario
        </Button>
      )}

      {link && (
        <div className="space-y-3">
          {checklist && (
            <>
              <ProgressBar value={pct} className="h-2" />
              <Text size="xs" tone="muted">
                {checklist.required_done} de {checklist.required_total} requeridos
                {checklist.missing.length > 0 && ` · Faltan: ${checklist.required.filter(i => !i.received).map(i => i.label).join(', ')}`}
              </Text>
            </>
          )}
          <div className="flex gap-2">
            <Input readOnly value={url} onFocus={e => e.target.select()} className="flex-1 text-xs" aria-label="Link del portal" />
            <Button variant="outline" size="icon" aria-label="Copiar link" onClick={() => copy(url)}>
              <Copy className="w-4 h-4" />
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {ownerPhone && <WhatsAppButton phone={ownerPhone} message={message} label="Mandar por WhatsApp" />}
            <Button variant="ghost" size="sm" icon={<RefreshCw className="w-3.5 h-3.5" />} onClick={openModal}>
              Regenerar
            </Button>
            <Button variant="ghost" size="sm" icon={<Trash2 className="w-3.5 h-3.5" />} className="text-danger" onClick={revoke}>
              Desactivar
            </Button>
          </div>
        </div>
      )}

      {docs.length > 0 && (
        <div className="mt-4 pt-3 border-t border-gray-100">
          <Text size="xs" weight="semibold" tone="muted" className="mb-1">Recibidos</Text>
          <ul className="divide-y divide-gray-50">
            {docs.map(d => (
              <li key={d.id} className="flex items-center gap-2 py-2">
                <FileText className="w-4 h-4 text-gray-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <Text size="sm" weight="medium" className="truncate">{d.recognized ? d.doc_label : d.original_name}</Text>
                  <Text size="xs" tone="muted" className="truncate">
                    {fmtDate(d.created_at)}
                    {d.issued_at ? ` · emitido ${d.issued_at}` : ''}
                    {d.recognized ? ` · ${d.original_name}` : ''}
                  </Text>
                </div>
                {!d.recognized && <Badge tone="warning">A revisar</Badge>}
                {d.drive_file_url && (
                  <Button href={d.drive_file_url} target="_blank" rel="noopener noreferrer" variant="ghost" size="icon" aria-label="Abrir en Drive">
                    <ExternalLink className="w-4 h-4" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={link ? 'Regenerar link' : 'Pedir documentación'}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button loading={saving} onClick={generate}>{link ? 'Generar link nuevo' : 'Generar link'}</Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Text size="sm" tone="muted">
            Con esto armamos la lista de lo que le vamos a pedir. El propietario no tiene que escribir la dirección: va con el link.
          </Text>
          {link && (
            <Text size="sm" tone="danger">El link anterior deja de funcionar.</Text>
          )}
          <PillRadioGroup label="Operación" options={DOC_OPERATION_OPTIONS} value={form.operation} onChange={v => setForm(f => ({ ...f, operation: v }))} />
          <PillRadioGroup label="Tipo de propiedad" options={DOC_KIND_OPTIONS} value={form.property_kind} onChange={v => setForm(f => ({ ...f, property_kind: v }))} />
          <PillRadioGroup label="¿Viene de una sucesión?" options={DOC_SUCCESSION_OPTIONS} value={form.succession} onChange={v => setForm(f => ({ ...f, succession: v }))} />
          {form.operation === 'venta' && (
            <PillRadioGroup
              label="¿El propietario está casado?"
              hint="Si está casado, el certificado de matrimonio pasa a ser obligatorio."
              options={DOC_MARRIED_OPTIONS}
              value={form.married}
              onChange={v => setForm(f => ({ ...f, married: v }))}
            />
          )}
        </div>
      </Modal>
    </Card>
  )
}
