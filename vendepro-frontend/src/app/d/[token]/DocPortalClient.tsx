'use client'

import { useEffect, useRef, useState } from 'react'
import { Camera, Check, Circle, Clock, Upload, Link2Off, RotateCcw, Send, FileText } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Alert } from '@/components/ui/Alert'
import { Input } from '@/components/ui/Input'
import { ProgressBar } from '@/components/ui/Progress'
import { Heading, Text } from '@/components/ui/Typography'
import { WhatsAppButton, CallButton } from '@/components/ui/ContactButtons'
import { WidgetHeader } from '@/components/ui/WidgetHeader'
import type { DocChecklistItem, PublicDocPortal } from '@/lib/doc-portal'
import DocScanner from './DocScanner'
import { AuthorizationSection, ReportsSection, ReservationSection } from './PortalSections'

interface Props {
  token: string
  apiPublic: string
  /** null = link revocado o propiedad cerrada. */
  data: PublicDocPortal | null
}

type QueueStatus = 'waiting' | 'uploading' | 'ok' | 'review' | 'error'
interface QueueItem {
  id: number
  file: File
  status: QueueStatus
  message?: string
  /** Lo que eligió el propietario en el escáner: pista para la IA. */
  declaredType?: string
}

const STATUS_BADGE: Record<QueueStatus, { tone: 'neutral' | 'info' | 'success' | 'warning' | 'danger'; label: string }> = {
  waiting: { tone: 'neutral', label: 'En espera' },
  uploading: { tone: 'info', label: 'Subiendo y revisando…' },
  ok: { tone: 'success', label: 'Recibido' },
  review: { tone: 'warning', label: 'Lo revisa tu agente' },
  error: { tone: 'danger', label: 'No se pudo subir' },
}

export default function DocPortalClient({ token, apiPublic, data }: Props) {
  const [checklist, setChecklist] = useState(data?.checklist ?? null)
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [finished, setFinished] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const [scannerOpen, setScannerOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const nextId = useRef(1)
  const busy = useRef(false)
  const uploadedThisVisit = useRef(false)
  const finishedRef = useRef(false)

  const base = `${apiPublic}/public/docs/${encodeURIComponent(token)}`
  const maxBytes = data?.limits.max_file_bytes ?? 15 * 1024 * 1024

  // Si se va sin tocar "Ya mandé todo", igual le avisamos al agente.
  useEffect(() => {
    const onHide = () => {
      if (!uploadedThisVisit.current || finishedRef.current) return
      navigator.sendBeacon?.(`${base}/done`, new Blob(['{}'], { type: 'text/plain' }))
    }
    window.addEventListener('pagehide', onHide)
    return () => window.removeEventListener('pagehide', onHide)
  }, [base])

  // Un archivo por vez, igual que la página de n8n: así cada uno vuelve con su resultado.
  useEffect(() => {
    if (busy.current) return
    const item = queue.find(q => q.status === 'waiting')
    if (!item) return
    busy.current = true
    setItem(item.id, { status: 'uploading' })

    const fd = new FormData()
    fd.append('archivo', item.file, item.file.name)
    if (item.declaredType) fd.append('tipo_declarado', item.declaredType)
    fetch(`${base}/upload`, { method: 'POST', body: fd })
      .then(async res => {
        const j = (await res.json().catch(() => ({}))) as any
        if (!res.ok) throw new Error(j?.error || 'No se pudo subir, probá de nuevo')
        uploadedThisVisit.current = true
        finishedRef.current = false
        setFinished(false)
        if (j.recognized) {
          setItem(item.id, { status: 'ok', message: j.doc_label })
          markReceived(j.doc_type)
        } else {
          setItem(item.id, { status: 'review' })
        }
      })
      .catch((err: Error) => setItem(item.id, { status: 'error', message: err.message }))
      .finally(() => {
        busy.current = false
        setQueue(q => [...q]) // destraba el siguiente
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue])

  function setItem(id: number, patch: Partial<QueueItem>) {
    setQueue(q => q.map(it => (it.id === id ? { ...it, ...patch } : it)))
  }

  function markReceived(type: string) {
    setChecklist(c => {
      if (!c) return c
      const mark = (items: DocChecklistItem[]) => items.map(i => (i.type === type ? { ...i, received: true } : i))
      const required = mark(c.required)
      return {
        ...c,
        required,
        optional: mark(c.optional),
        required_done: required.filter(i => i.received).length,
        missing: required.filter(i => !i.received).map(i => i.type),
      }
    })
  }

  function addFiles(files: FileList | File[] | null, declaredType?: string) {
    if (!files?.length) return
    const items: QueueItem[] = Array.from(files).map(file => ({
      id: nextId.current++,
      file,
      declaredType,
      status: file.size > maxBytes ? 'error' : 'waiting',
      message: file.size > maxBytes ? 'Supera 15 MB' : undefined,
    }))
    setQueue(q => [...q, ...items])
  }

  async function finish() {
    setFinishing(true)
    await fetch(`${base}/done`, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: '{}' }).catch(() => {})
    finishedRef.current = true
    setFinished(true)
    setFinishing(false)
  }

  if (!data || !checklist) {
    return (
      <Shell>
        <Card className="text-center space-y-3 py-10">
          <Link2Off className="w-8 h-8 mx-auto text-gray-400" />
          <Heading level={3}>Este link ya no está activo</Heading>
          <Text tone="muted">Pedile uno nuevo a tu agente.</Text>
        </Card>
      </Shell>
    )
  }

  // En el escáner, primero lo que falta; lo ya recibido sigue disponible por si
  // hay que reemplazarlo.
  const all = [...checklist.required, ...checklist.optional]
  const scanOptions = [
    ...all.filter(i => !i.received).map(i => ({ value: i.type, label: i.label })),
    ...all.filter(i => i.received).map(i => ({ value: i.type, label: i.label })),
    { value: 'otro', label: 'Otro documento' },
  ]

  const pct = checklist.required_total ? Math.round((checklist.required_done / checklist.required_total) * 100) : 0
  const uploading = queue.some(q => q.status === 'waiting' || q.status === 'uploading')
  const anySent = queue.some(q => q.status === 'ok' || q.status === 'review')

  return (
    <Shell org={data.org}>
      <div className="space-y-1">
        <Text size="xs" tone="muted">{data.operation === 'alquiler' ? 'Alquiler' : 'Venta'} de tu propiedad</Text>
        <Heading level={2}>{data.address}</Heading>
      </div>

      {data.agent && (
        <Card className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <Text size="xs" tone="muted">Te atiende</Text>
            <Text weight="medium" className="truncate">{data.agent.name}</Text>
          </div>
          {data.agent.phone && (
            <div className="flex gap-2 shrink-0">
              <WhatsAppButton phone={data.agent.phone} iconOnly />
              <CallButton phone={data.agent.phone} iconOnly />
            </div>
          )}
        </Card>
      )}

      {data.reservation && <ReservationSection reservation={data.reservation} />}

      <Card className="space-y-4">
        <WidgetHeader
          icon={<Upload className="w-4 h-4" />}
          title="Subí tus documentos"
          subtitle="Escaneá cada papel con la cámara o subí los PDF que ya tengas, de hasta 15 MB."
        />
        {/* El selector nativo queda oculto: lo abre el botón de abajo. */}
        <Input
          ref={inputRef}
          type="file"
          multiple
          accept=".pdf,image/*"
          hidden
          onChange={e => { addFiles(e.target.files); e.target.value = '' }}
        />
        <Button fullWidth size="lg" icon={<Camera className="w-4 h-4" />} onClick={() => setScannerOpen(true)}>
          Escanear con la cámara
        </Button>
        <Button variant="outline" fullWidth icon={<Upload className="w-4 h-4" />} onClick={() => inputRef.current?.click()}>
          Subir PDF o fotos que ya tengo
        </Button>
        <Text size="xs" tone="muted">
          ¿Preferís tu app de siempre? En iPhone, Notas o Archivos tienen “Escanear documentos”; en Android, Google Drive tiene “Escanear”. Guardá el PDF y subilo con el botón de arriba.
        </Text>

        {queue.length > 0 && (
          <ul className="divide-y divide-gray-100">
            {queue.map(item => {
              const badge = STATUS_BADGE[item.status]
              return (
                <li key={item.id} className="flex items-center gap-2 py-2">
                  <FileText className="w-4 h-4 text-gray-400 shrink-0" />
                  <Text size="sm" className="flex-1 min-w-0 truncate">{item.file.name}</Text>
                  <Badge tone={badge.tone}>
                    {item.status === 'ok' && item.message ? item.message : item.status === 'error' && item.message ? item.message : badge.label}
                  </Badge>
                  {item.status === 'error' && item.file.size <= maxBytes && (
                    <Button variant="ghost" size="icon" aria-label="Reintentar" onClick={() => setItem(item.id, { status: 'waiting', message: undefined })}>
                      <RotateCcw className="w-4 h-4" />
                    </Button>
                  )}
                </li>
              )
            })}
          </ul>
        )}

        {finished ? (
          <Alert tone="success">
            ¡Gracias! Le avisamos a {data.agent?.name ?? 'tu agente'}. Si te falta algo, podés volver a entrar con este mismo link.
          </Alert>
        ) : anySent && (
          <Button variant="outline" fullWidth loading={finishing} disabled={uploading} icon={<Send className="w-4 h-4" />} onClick={finish}>
            Ya mandé todo
          </Button>
        )}
      </Card>

      <DocScanner
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        options={scanOptions}
        maxBytes={maxBytes}
        onDone={(file, docType) => addFiles([file], docType)}
      />

      <Card className="space-y-4">
        <WidgetHeader
          title="Qué necesitamos"
          subtitle={`${checklist.required_done} de ${checklist.required_total} documentos recibidos`}
          action={<Text weight="bold">{pct}%</Text>}
        />
        <ProgressBar value={pct} className="h-2" />
        <ChecklistGroup title="Te pedimos" items={checklist.required} />
        {checklist.optional.length > 0 && <ChecklistGroup title="Si corresponde" items={checklist.optional} />}
        {checklist.internal.length > 0 && (
          <div className="space-y-2">
            <Text size="xs" weight="semibold" tone="muted">Lo pedimos nosotros</Text>
            {checklist.internal.map(i => (
              <div key={i.type} className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-gray-400 shrink-0" />
                <Text size="sm" tone="muted">{i.label} — no tenés que hacer nada</Text>
              </div>
            ))}
          </div>
        )}
      </Card>

      {data.documents.length > 0 && (
        <Card className="space-y-3">
          <WidgetHeader title="Ya nos mandaste" subtitle="Lo que recibimos en visitas anteriores" />
          <ul className="divide-y divide-gray-100">
            {data.documents.map(d => (
              <li key={d.id} className="flex items-center gap-2 py-2">
                <FileText className="w-4 h-4 text-gray-400 shrink-0" />
                <Text size="sm" className="flex-1 min-w-0 truncate">{d.original_name}</Text>
                <Badge tone={d.recognized ? 'success' : 'warning'}>{d.recognized ? d.doc_label : 'Lo revisa tu agente'}</Badge>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {data.authorization && <AuthorizationSection authorization={data.authorization} />}
      {data.reports.length > 0 && <ReportsSection reports={data.reports} />}
    </Shell>
  )
}

function ChecklistGroup({ title, items }: { title: string; items: DocChecklistItem[] }) {
  return (
    <div className="space-y-2">
      <Text size="xs" weight="semibold" tone="muted">{title}</Text>
      {items.map(i => (
        <div key={i.type} className="flex items-center gap-2">
          {i.received
            ? <Check className="w-4 h-4 text-success shrink-0" aria-label="Recibido" />
            : <Circle className="w-4 h-4 text-gray-300 shrink-0" aria-label="Pendiente" />}
          <Text size="sm" tone={i.received ? 'muted' : 'default'} className={i.received ? 'line-through' : undefined}>
            {i.label}
          </Text>
        </div>
      ))}
    </div>
  )
}

/** Marco de la página: marca de la inmobiliaria arriba, contenido angosto (mobile-first). */
function Shell({ org, children }: { org?: { name: string; logo_url: string | null }; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 py-6 px-4">
      <div className="max-w-xl mx-auto space-y-4">
        {org && (
          org.logo_url
            ? <img src={org.logo_url} alt={org.name} className="h-10 w-auto object-contain" />
            : <Heading level={3}>{org.name}</Heading>
        )}
        {children}
      </div>
    </div>
  )
}
