'use client'

import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { Check, Maximize, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Text } from '@/components/ui/Typography'
import type { CropDraft } from '@/lib/doc-scan'
import type { Quad } from '@/lib/doc-crop'

interface Props {
  draft: CropDraft
  /** 1-based, para el título ("Página 2"). */
  pageNumber: number
  busy?: boolean
  onAccept: (quad: Quad) => void
  /** Usar la foto entera, sin recortar. */
  onUseFull: () => void
  onDiscard: () => void
}

const CORNER_NAMES = ['arriba a la izquierda', 'arriba a la derecha', 'abajo a la derecha', 'abajo a la izquierda']
const clamp = (v: number) => Math.min(1, Math.max(0, v))

/**
 * Recorte semiautomático: arranca con las esquinas que detectó el escáner y el
 * propietario las corrige arrastrando (o con las flechas del teclado) antes de
 * aceptar. Las esquinas viajan normalizadas 0..1, así no dependen del tamaño
 * en pantalla.
 */
export default function CropEditor({ draft, pageNumber, busy = false, onAccept, onUseFull, onDiscard }: Props) {
  const [quad, setQuad] = useState<Quad>(draft.quad)
  const boxRef = useRef<HTMLDivElement>(null)
  const dragging = useRef<number | null>(null)

  function moveTo(index: number, clientX: number, clientY: number) {
    const rect = boxRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = clamp((clientX - rect.left) / rect.width)
    const y = clamp((clientY - rect.top) / rect.height)
    setQuad(q => q.map((p, i) => (i === index ? { x, y } : p)) as Quad)
  }

  function onPointerDown(index: number, e: PointerEvent<HTMLDivElement>) {
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    dragging.current = index
  }

  function onPointerMove(index: number, e: PointerEvent<HTMLDivElement>) {
    if (dragging.current !== index) return
    moveTo(index, e.clientX, e.clientY)
  }

  function onKeyDown(index: number, e: KeyboardEvent<HTMLDivElement>) {
    const step = e.shiftKey ? 0.05 : 0.01
    const delta: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step],
    }
    const d = delta[e.key]
    if (!d) return
    e.preventDefault()
    setQuad(q => q.map((p, i) => (i === index ? { x: clamp(p.x + d[0]), y: clamp(p.y + d[1]) } : p)) as Quad)
  }

  const aspect = draft.width / draft.height
  const points = quad.map(p => `${p.x},${p.y}`).join(' ')

  return (
    <div className="space-y-3">
      <Text size="sm" tone="muted">
        {draft.detected
          ? `Página ${pageNumber}: marcamos los bordes de la hoja. Si no coinciden, mové las esquinas.`
          : `Página ${pageNumber}: no encontramos los bordes solos. Mové las esquinas hasta las puntas de la hoja.`}
      </Text>

      {/* Caja con la proporción de la foto: así las coordenadas 0..1 coinciden con la imagen. */}
      <div
        ref={boxRef}
        className="relative mx-auto select-none touch-none rounded-control overflow-hidden bg-gray-900"
        style={{ aspectRatio: String(aspect), width: '100%', maxWidth: `calc(55vh * ${aspect})` }}
      >
        <img src={draft.previewUrl} alt={`Foto de la página ${pageNumber}`} className="absolute inset-0 w-full h-full" draggable={false} />
        <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden>
          {/* Afuera del recorte, oscurecido; adentro, la hoja tal cual. */}
          <path
            d={`M0,0 H1 V1 H0 Z M${quad.map(p => `${p.x},${p.y}`).join(' L')} Z`}
            fillRule="evenodd"
            className="fill-black/50"
          />
          <polygon points={points} fill="none" vectorEffect="non-scaling-stroke" strokeWidth={2} className="stroke-primary" />
        </svg>
        {quad.map((p, i) => (
          <div
            key={i}
            role="slider"
            tabIndex={0}
            aria-label={`Esquina ${CORNER_NAMES[i]}`}
            aria-valuetext={`${Math.round(p.x * 100)}% horizontal, ${Math.round(p.y * 100)}% vertical`}
            onPointerDown={e => onPointerDown(i, e)}
            onPointerMove={e => onPointerMove(i, e)}
            onPointerUp={() => { dragging.current = null }}
            onPointerCancel={() => { dragging.current = null }}
            onKeyDown={e => onKeyDown(i, e)}
            // 44px de zona táctil con un círculo visible de 22px en el medio.
            className="absolute w-11 h-11 -ml-[22px] -mt-[22px] flex items-center justify-center cursor-grab active:cursor-grabbing focus-visible:outline-none group"
            style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }}
          >
            <span className="w-[22px] h-[22px] rounded-full bg-white border-[3px] border-primary shadow-pop group-focus-visible:ring-4 group-focus-visible:ring-primary/40" />
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 justify-end">
        <Button variant="ghost" size="sm" icon={<Trash2 className="w-4 h-4" />} className="text-danger" onClick={onDiscard} disabled={busy}>
          Descartar
        </Button>
        <Button variant="ghost" size="sm" icon={<Maximize className="w-4 h-4" />} onClick={onUseFull} disabled={busy}>
          Usar la foto entera
        </Button>
        <Button size="sm" icon={<Check className="w-4 h-4" />} onClick={() => onAccept(quad)} loading={busy}>
          Usar este recorte
        </Button>
      </div>
    </div>
  )
}
