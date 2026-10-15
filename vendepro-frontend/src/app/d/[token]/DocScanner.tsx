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
import { buildPdfFromJpegs, processPhoto, scanFileName, type ScannedPage } from '@/lib/doc-scan'

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
 * Escanear con la cámara: el propietario saca una foto por página y sale UN PDF
 * con el nombre del documento. Todo pasa en el celular; al servidor llega el PDF.
 */
export default function DocScanner({ open, onClose, options, maxBytes, onDone }: Props) {
  const [docType, setDocType] = useState(options[0]?.value ?? 'otro')
  const [pages, setPages] = useState<ScannedPage[]>([])
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

  function reset() {
    pages.forEach(p => URL.revokeObjectURL(p.previewUrl))
    setPages([])
    setError(null)
  }

  function close() {
    reset()
    onClose()
  }

  async function addPhotos(files: FileList | null) {
    if (!files?.length) return
    setProcessing(true)
    setError(null)
    try {
      const room = MAX_PAGES - pages.length
      const added: ScannedPage[] = []
      for (const f of Array.from(files).slice(0, room)) {
        added.push(await processPhoto(f, enhance))
      }
      setPages(prev => [...prev, ...added])
      if (files.length > room) setError(`Hasta ${MAX_PAGES} páginas por documento.`)
    } catch {
      setError('No pudimos leer esa foto. Probá sacarla de nuevo.')
    }
    setProcessing(false)
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

  return (
    <Modal
      open={open}
      onClose={close}
      sheet
      title="Escanear documento"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={close}>Cancelar</Button>
          <Button onClick={finish} disabled={pages.length === 0 || processing} loading={processing && pages.length > 0}>
            Subir {pages.length > 0 ? `(${pages.length} ${pages.length === 1 ? 'página' : 'páginas'})` : ''}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <PillRadioGroup
          label="¿Qué documento es?"
          size="sm"
          options={options}
          value={docType}
          onChange={setDocType}
        />

        {/* Selectores nativos ocultos: la cámara trasera directo, o la galería. */}
        <Input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden
          onChange={e => { addPhotos(e.target.files); e.target.value = '' }} />
        <Input ref={galleryRef} type="file" accept="image/*" multiple hidden
          onChange={e => { addPhotos(e.target.files); e.target.value = '' }} />

        {pages.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {pages.map((p, i) => (
              <div key={p.previewUrl} className="relative rounded-control overflow-hidden border border-gray-200 bg-gray-50 aspect-[3/4]">
                <img src={p.previewUrl} alt={`Página ${i + 1}`} className="w-full h-full object-cover" />
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
            disabled={processing || pages.length >= MAX_PAGES}
            icon={processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
            onClick={() => cameraRef.current?.click()}
          >
            {pages.length === 0 ? 'Sacar foto de la primera página' : `Sacar foto de la página ${pages.length + 1}`}
          </Button>
          <Button variant="ghost" size="sm" disabled={processing} icon={<ImagePlus className="w-4 h-4" />}
            onClick={() => galleryRef.current?.click()}>
            Elegir fotos de la galería
          </Button>
        </div>

        <Switch checked={enhance} onChange={setEnhance} label="Mejorar como escaneo (blanco y negro, más contraste)" />

        <Text size="xs" tone="muted">
          Apoyá la hoja sobre una mesa con buena luz y encuadrala entera. Si un documento tiene frente y dorso, sacá las dos caras: van en el mismo PDF.
        </Text>

        {error && <Alert tone="warning">{error}</Alert>}
      </div>
    </Modal>
  )
}
