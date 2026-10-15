'use client'

import { useEffect, useRef, useState } from 'react'
import { Camera, ImagePlus, Loader2, Trash2 } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Switch } from '@/components/ui/Switch'
import { Alert } from '@/components/ui/Alert'
import { Text } from '@/components/ui/Typography'
import { PillRadioGroup } from '@/components/ui/ChoicePills'
import { buildPdfFromJpegs, prepareCrop, processPhoto, scanFileName, type CropDraft, type ScannedPage } from '@/lib/doc-scan'
import type { Quad } from '@/lib/doc-crop'
import CropEditor from './CropEditor'

const MAX_PAGES = 30

interface Props {
  open: boolean
  onClose: () => void
  /** Documentos para elegir (los pendientes primero). */
  options: Array<{ value: string; label: string }>
  maxBytes: number
  /** El PDF armado y el documento que eligió el propietario (pista para la IA). */
  onDone: (file: File, docType: string) => void
}

/**
 * Escanear con la cámara: el propietario saca una foto por página, revisa el
 * recorte que propone el escáner (puede mover las esquinas) y sale UN PDF con
 * el nombre del documento. Todo pasa en el celular; al servidor llega el PDF.
 */
export default function DocScanner({ open, onClose, options, maxBytes, onDone }: Props) {
  const [docType, setDocType] = useState(options[0]?.value ?? 'otro')
  const [pages, setPages] = useState<ScannedPage[]>([])
  /** Fotos que todavía no pasaron por el recorte, en orden. */
  const [pending, setPending] = useState<File[]>([])
  const [draft, setDraft] = useState<CropDraft | null>(null)
  const [enhance, setEnhance] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const cameraRef = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)

  // Cada vez que se abre arranca de cero con el primer pendiente elegido.
  useEffect(() => {
    if (!open) return
    setDocType(options[0]?.value ?? 'otro')
    setError(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // La primera foto en espera pasa al editor: se detectan los bordes y se muestra.
  // La guarda es un ref (no estado) para que el "procesando" no relance ni
  // cancele la detección en curso.
  const preparing = useRef(false)
  const mounted = useRef(true)
  useEffect(() => () => { mounted.current = false }, [])
  useEffect(() => {
    if (draft || preparing.current || pending.length === 0) return
    preparing.current = true
    setProcessing(true)
    prepareCrop(pending[0])
      .then(d => {
        if (mounted.current) setDraft(d)
        else URL.revokeObjectURL(d.previewUrl)
      })
      .catch(() => {
        if (!mounted.current) return
        setError('No pudimos leer esa foto. Probá sacarla de nuevo.')
        preparing.current = false
        setPending(p => p.slice(1))
      })
      .finally(() => {
        preparing.current = false
        if (mounted.current) setProcessing(false)
      })
  }, [pending, draft])

  function clearDraft() {
    if (draft) URL.revokeObjectURL(draft.previewUrl)
    setDraft(null)
    setPending(p => p.slice(1))
  }

  function reset() {
    pages.forEach(p => URL.revokeObjectURL(p.previewUrl))
    if (draft) URL.revokeObjectURL(draft.previewUrl)
    setPages([])
    setPending([])
    setDraft(null)
    setError(null)
  }

  function close() {
    reset()
    onClose()
  }

  function addPhotos(files: FileList | null) {
    if (!files?.length) return
    setError(null)
    const room = MAX_PAGES - pages.length - pending.length
    const list = Array.from(files)
    setPending(p => [...p, ...list.slice(0, Math.max(0, room))])
    if (list.length > room) setError(`Hasta ${MAX_PAGES} páginas por documento.`)
  }

  /** Recorta (o no) la foto del editor y la suma como página. */
  async function keep(quad: Quad | null) {
    const file = pending[0]
    if (!file) return
    setProcessing(true)
    try {
      const page = await processPhoto(file, enhance, quad)
      setPages(prev => [...prev, page])
    } catch {
      setError('No pudimos procesar esa foto. Probá sacarla de nuevo.')
    }
    setProcessing(false)
    clearDraft()
  }

  function removePage(i: number) {
    setPages(prev => {
      URL.revokeObjectURL(prev[i].previewUrl)
      return prev.filter((_, j) => j !== i)
    })
  }

  async function finish() {
    setProcessing(true)
    try {
      const pdf = await buildPdfFromJpegs(pages)
      if (pdf.size > maxBytes) {
        setError('El PDF quedó muy pesado. Probá con menos páginas o separalo en dos documentos.')
        setProcessing(false)
        return
      }
      const label = options.find(o => o.value === docType)?.label ?? 'Documento escaneado'
      onDone(new File([pdf], scanFileName(label), { type: 'application/pdf' }), docType)
      reset()
      onClose()
    } catch {
      setError('No pudimos armar el PDF. Probá de nuevo.')
    }
    setProcessing(false)
  }

  const cropping = !!draft
  const nextPage = pages.length + 1

  return (
    <Modal
      open={open}
      onClose={close}
      sheet
      title="Escanear documento"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={close}>Cancelar</Button>
          <Button onClick={finish} disabled={pages.length === 0 || processing || cropping || pending.length > 0}
            loading={processing && pages.length > 0 && !cropping}>
            Subir {pages.length > 0 ? `(${pages.length} ${pages.length === 1 ? 'página' : 'páginas'})` : ''}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Mientras se recorta, la foto va arriba: en el celular el selector la empujaba fuera de pantalla. */}
        {!draft && (
          <PillRadioGroup
            label="¿Qué documento es?"
            size="sm"
            options={options}
            value={docType}
            onChange={setDocType}
          />
        )}

        {/* Selectores nativos ocultos: la cámara trasera directo, o la galería. */}
        <Input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden
          onChange={e => { addPhotos(e.target.files); e.target.value = '' }} />
        <Input ref={galleryRef} type="file" accept="image/*" multiple hidden
          onChange={e => { addPhotos(e.target.files); e.target.value = '' }} />

        {draft ? (
          <CropEditor
            key={draft.previewUrl}
            draft={draft}
            pageNumber={nextPage}
            busy={processing}
            onAccept={quad => keep(quad)}
            onUseFull={() => keep(null)}
            onDiscard={clearDraft}
          />
        ) : (
          <>
            {pages.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {pages.map((p, i) => (
                  <div key={p.previewUrl} className="relative rounded-control overflow-hidden border border-gray-200 bg-gray-50 aspect-[3/4]">
                    <img src={p.previewUrl} alt={`Página ${i + 1}`} className="w-full h-full object-contain" />
                    <Text size="xs" weight="semibold" className="absolute bottom-1 left-1 bg-white/90 rounded-full px-1.5">{i + 1}</Text>
                    <Button variant="ghost" size="icon" aria-label={`Borrar página ${i + 1}`} onClick={() => removePage(i)}
                      className="absolute top-1 right-1 bg-white/90 p-1">
                      <Trash2 className="w-3.5 h-3.5 text-danger" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-col gap-2">
              <Button
                variant="outline"
                fullWidth
                disabled={processing || pages.length + pending.length >= MAX_PAGES}
                icon={processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                onClick={() => cameraRef.current?.click()}
              >
                {pages.length === 0 ? 'Sacar foto de la primera página' : `Sacar foto de la página ${nextPage}`}
              </Button>
              <Button variant="ghost" size="sm" disabled={processing} icon={<ImagePlus className="w-4 h-4" />}
                onClick={() => galleryRef.current?.click()}>
                Elegir fotos de la galería
              </Button>
            </div>

            <Switch checked={enhance} onChange={setEnhance} label="Mejorar como escaneo (blanco y negro, más contraste)" />

            <Text size="xs" tone="muted">
              Apoyá la hoja sobre una mesa más oscura que el papel, con buena luz. Después de cada foto podés ajustar el recorte. Si un documento tiene frente y dorso, sacá las dos caras: van en el mismo PDF.
            </Text>
          </>
        )}

        {error && <Alert tone="warning">{error}</Alert>}
      </div>
    </Modal>
  )
}
