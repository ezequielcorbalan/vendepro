'use client'
import { useRef, useState } from 'react'
import { Plus, X, Sparkles, ImageIcon, Loader2 } from 'lucide-react'
import type { WizardState } from '../use-wizard-form'
import {
  clipboardImageFromEvent,
  extractComparableFromImage,
  type ExtractedComparable,
} from '../../shared/extract-comparable'

type ComparableRow = WizardState['comparables'][number]

interface Props {
  comparables: WizardState['comparables']
  onAddComparable: (c: ComparableRow) => void
  onPatchComparable: (index: number, patch: Partial<ComparableRow>) => void
  onRemoveComparable: (index: number) => void
}

const inputClass =
  'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-[#ff007c] focus:outline-none focus:ring-2 focus:ring-[#ff007c]/30'
const labelClass = 'mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500'

const EMPTY: ComparableRow = {
  zonaprop_url: null,
  address: null,
  total_area: null,
  covered_area: null,
  price: null,
  usd_per_m2: null,
  days_on_market: null,
  views_per_day: null,
  age: null,
}

export function StepCompetencia({
  comparables,
  onAddComparable,
  onPatchComparable,
  onRemoveComparable,
}: Props) {
  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Competencia ZonaProp</h3>
          <p className="mt-1 text-sm text-slate-500">
            Sumá hasta 5–6 publicaciones similares de la zona como referencia. Pegá una captura
            (Ctrl+V) o subí una imagen y completamos los campos automáticamente.
          </p>
        </div>
        <button
          type="button"
          onClick={() => onAddComparable({ ...EMPTY })}
          className="flex shrink-0 items-center gap-1.5 rounded-lg bg-[#ff007c] px-3 py-2 text-sm text-white hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> Agregar
        </button>
      </header>

      {comparables.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 px-6 py-10 text-center">
          <p className="text-sm text-slate-500">
            Todavía no agregaste comparables. Click en <strong>Agregar</strong> para sumar el primero.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {comparables.map((c, i) => (
            <ComparableCard
              key={i}
              index={i}
              comparable={c}
              onPatch={(patch) => onPatchComparable(i, patch)}
              onRemove={() => onRemoveComparable(i)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function ComparableCard({
  index,
  comparable,
  onPatch,
  onRemove,
}: {
  index: number
  comparable: ComparableRow
  onPatch: (patch: Partial<ComparableRow>) => void
  onRemove: () => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [extracting, setExtracting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [highlight, setHighlight] = useState(false)

  const applyExtraction = (data: ExtractedComparable) => {
    // Solo pisamos campos vacíos para no sobreescribir lo que el usuario haya tipeado.
    const patch: Partial<ComparableRow> = {}
    for (const key of [
      'address', 'zonaprop_url', 'total_area', 'covered_area',
      'price', 'usd_per_m2', 'days_on_market', 'views_per_day', 'age',
    ] as const) {
      const incoming = data[key]
      const current = comparable[key]
      if (incoming !== null && incoming !== undefined && (current === null || current === undefined || current === '')) {
        ;(patch as any)[key] = incoming
      }
    }
    if (Object.keys(patch).length > 0) onPatch(patch)
  }

  const handleFile = async (file: File) => {
    setExtracting(true)
    setError(null)
    setPreviewUrl(URL.createObjectURL(file))
    try {
      const data = await extractComparableFromImage(file)
      applyExtraction(data)
    } catch (e: any) {
      setError(e?.message ?? 'No se pudo extraer la información')
    } finally {
      setExtracting(false)
    }
  }

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    const file = clipboardImageFromEvent(e)
    if (file) {
      e.preventDefault()
      handleFile(file)
    }
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setHighlight(false)
    const file = e.dataTransfer.files?.[0]
    if (file && file.type.startsWith('image/')) handleFile(file)
  }

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="mb-4 flex items-center justify-between">
        <h4 className="text-sm font-semibold text-slate-800">Comparable {index + 1}</h4>
        <button
          type="button"
          onClick={onRemove}
          className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-500"
          title="Eliminar"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-4">
        <div>
          <label className={labelClass}>Link de ZonaProp (referencia)</label>
          <input
            type="url"
            value={comparable.zonaprop_url ?? ''}
            onChange={(e) => onPatch({ zonaprop_url: e.target.value || null })}
            placeholder="https://www.zonaprop.com.ar/..."
            className={inputClass}
          />
        </div>

        {/* Drop zone para captura — paste, drop o file picker */}
        <div
          tabIndex={0}
          onPaste={handlePaste}
          onDragOver={(e) => { e.preventDefault(); setHighlight(true) }}
          onDragLeave={() => setHighlight(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
          className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed px-4 py-6 text-center transition ${
            highlight ? 'border-[#ff007c] bg-rose-50' : 'border-slate-300 hover:border-[#ff007c]/60'
          }`}
        >
          {extracting ? (
            <>
              <Loader2 className="h-6 w-6 animate-spin text-[#ff007c]" />
              <p className="text-sm font-medium text-slate-700">Analizando captura con IA...</p>
            </>
          ) : previewUrl ? (
            <>
              <img src={previewUrl} alt="" className="max-h-32 rounded shadow-sm" />
              <p className="mt-2 text-xs text-emerald-600">
                <Sparkles className="mr-1 inline h-3 w-3" />
                Datos extraídos. Pegá otra para reemplazar.
              </p>
            </>
          ) : (
            <>
              <Sparkles className="h-6 w-6 text-[#ff007c]" />
              <p className="text-sm font-medium text-slate-700">
                Click acá y pegá screenshot (Ctrl+V)
              </p>
              <p className="text-xs text-slate-500">
                <ImageIcon className="mr-1 inline h-3 w-3" /> O subí una imagen
              </p>
            </>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) handleFile(f)
              e.target.value = ''
            }}
          />
        </div>
        {error && <p className="text-xs text-rose-500">{error}</p>}

        {/* Campos extraíbles */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <label className={labelClass}>Dirección</label>
            <input
              type="text"
              value={comparable.address ?? ''}
              onChange={(e) => onPatch({ address: e.target.value || null })}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Precio USD</label>
            <input
              type="number"
              min={0}
              value={comparable.price ?? ''}
              onChange={(e) => onPatch({ price: e.target.value ? Number(e.target.value) : null })}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>USD/m²</label>
            <input
              type="number"
              min={0}
              value={comparable.usd_per_m2 ?? ''}
              onChange={(e) => onPatch({ usd_per_m2: e.target.value ? Number(e.target.value) : null })}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>m² total</label>
            <input
              type="number"
              min={0}
              value={comparable.total_area ?? ''}
              onChange={(e) => onPatch({ total_area: e.target.value ? Number(e.target.value) : null })}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>m² cubierto</label>
            <input
              type="number"
              min={0}
              value={comparable.covered_area ?? ''}
              onChange={(e) => onPatch({ covered_area: e.target.value ? Number(e.target.value) : null })}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Días en venta</label>
            <input
              type="number"
              min={0}
              value={comparable.days_on_market ?? ''}
              onChange={(e) => onPatch({ days_on_market: e.target.value ? Number(e.target.value) : null })}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Vistas 30d</label>
            <input
              type="number"
              min={0}
              value={comparable.views_per_day ?? ''}
              onChange={(e) => onPatch({ views_per_day: e.target.value ? Number(e.target.value) : null })}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Antigüedad</label>
            <input
              type="number"
              min={0}
              value={comparable.age ?? ''}
              onChange={(e) => onPatch({ age: e.target.value ? Number(e.target.value) : null })}
              className={inputClass}
            />
          </div>
        </div>
      </div>
    </article>
  )
}
