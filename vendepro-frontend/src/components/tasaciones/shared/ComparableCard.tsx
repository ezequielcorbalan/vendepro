'use client'
import { useRef, useState } from 'react'
import {
  X, Sparkles, ImageIcon, Loader2, ChevronDown, ChevronUp,
  ArrowUp, ArrowDown, Database,
} from 'lucide-react'
import {
  clipboardImageFromEvent,
  extractComparableFromImage,
  type ExtractedComparable,
} from './extract-comparable'

export type ComparableKind = 'publicacion' | 'venta'

export interface ComparableData {
  kind?: ComparableKind
  zonaprop_url?: string | null
  address?: string | null
  total_area?: number | null
  covered_area?: number | null
  price?: number | null
  usd_per_m2?: number | null
  days_on_market?: number | null
  views_per_day?: number | null
  age?: number | null
  // Solo venta
  closing_price_usd?: number | null
  closed_at?: string | null
  source_sold_property_id?: string | null
}

interface Props {
  index: number
  comparable: ComparableData
  onPatch: (patch: Partial<ComparableData>) => void
  onRemove: () => void
  /** Para reordenar dentro de la lista. Opcional — si no se pasa, no se muestran flechas. */
  onMoveUp?: () => void
  onMoveDown?: () => void
  canMoveUp?: boolean
  canMoveDown?: boolean
  /** Si true, arranca colapsado (default true salvo en card recién creada). */
  defaultCollapsed?: boolean
}

const inputClass =
  'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-[#ff007c] focus:outline-none focus:ring-2 focus:ring-[#ff007c]/30'
const labelClass = 'mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500'

const EXTRACTABLE_KEYS = [
  'address', 'zonaprop_url', 'total_area', 'covered_area',
  'price', 'usd_per_m2', 'days_on_market', 'views_per_day', 'age',
] as const

function formatPriceUsd(n: number | null | undefined): string | null {
  if (typeof n !== 'number') return null
  return `USD ${n.toLocaleString('es-AR')}`
}

export function ComparableCard({
  index, comparable, onPatch, onRemove,
  onMoveUp, onMoveDown, canMoveUp, canMoveDown,
  defaultCollapsed = true,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [extracting, setExtracting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [extracted, setExtracted] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [highlight, setHighlight] = useState(false)
  const [collapsed, setCollapsed] = useState(defaultCollapsed)

  const kind: ComparableKind = comparable.kind ?? 'publicacion'
  const isVenta = kind === 'venta'
  const fromSoldProperty = Boolean(comparable.source_sold_property_id)

  const applyExtraction = (data: ExtractedComparable) => {
    const patch: Partial<ComparableData> = {}
    for (const key of EXTRACTABLE_KEYS) {
      const incoming = data[key]
      const current = (comparable as any)[key]
      if (incoming !== null && incoming !== undefined && (current === null || current === undefined || current === '')) {
        ;(patch as any)[key] = incoming
      }
    }
    // En cierres reales, si la IA detectó un precio y closing_price_usd está
    // vacío, lo asumimos como precio de cierre (que es lo más probable en un
    // screenshot de venta). El usuario lo puede mover a "Precio publicado"
    // si quería usarlo como referencia de listado.
    if (kind === 'venta'
        && typeof data.price === 'number'
        && (comparable.closing_price_usd === null || comparable.closing_price_usd === undefined)) {
      patch.closing_price_usd = data.price
      // No duplicamos el dato en `price` — la IA lo puso ahí pero para venta
      // preferimos verlo como precio de cierre.
      if (patch.price === data.price) delete (patch as any).price
    }
    if (Object.keys(patch).length > 0) onPatch(patch)
  }

  const handleFile = async (file: File) => {
    setExtracting(true)
    setError(null)
    setExtracted(false)
    setPreviewUrl(URL.createObjectURL(file))
    try {
      const data = await extractComparableFromImage(file)
      applyExtraction(data)
      setExtracted(true)
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

  const kindPill = isVenta
    ? <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">Cierre real</span>
    : <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-[#ff007c]">Publicación</span>

  const summaryPrice = isVenta
    ? formatPriceUsd(comparable.closing_price_usd)
    : formatPriceUsd(comparable.price)
  const summaryAddress = comparable.address || `Comparable ${index + 1}`

  return (
    <article className="rounded-xl border border-slate-200 bg-white">
      {/* Header colapsable (siempre visible) */}
      <header className="flex items-center gap-2 px-4 py-3">
        <button
          type="button"
          onClick={() => setCollapsed(v => !v)}
          className="flex flex-1 items-center gap-2 text-left"
          aria-expanded={!collapsed}
        >
          {collapsed
            ? <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
            : <ChevronUp className="h-4 w-4 shrink-0 text-slate-400" />}
          {kindPill}
          <span className="truncate text-sm font-semibold text-slate-800">{summaryAddress}</span>
          {summaryPrice && (
            <span className="ml-auto whitespace-nowrap text-xs font-semibold text-slate-700">
              {summaryPrice}
            </span>
          )}
        </button>

        {/* Acciones */}
        <div className="flex items-center gap-0.5">
          {onMoveUp && (
            <button
              type="button"
              onClick={onMoveUp}
              disabled={!canMoveUp}
              title="Subir"
              className="rounded p-1 text-slate-400 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <ArrowUp className="h-3.5 w-3.5" />
            </button>
          )}
          {onMoveDown && (
            <button
              type="button"
              onClick={onMoveDown}
              disabled={!canMoveDown}
              title="Bajar"
              className="rounded p-1 text-slate-400 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <ArrowDown className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={onRemove}
            title="Eliminar"
            className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-500"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Body — solo si está expandido */}
      {!collapsed && (
        <div className="border-t border-slate-100 px-5 py-4">
          {fromSoldProperty && (
            <p className="mb-3 flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-1.5 text-[11px] text-emerald-700">
              <Database className="h-3 w-3" />
              Datos extraídos de tu base de Cierres Reales.
            </p>
          )}

          <div className="space-y-4">
            {/* Link de ZonaProp solo aplica a publicación */}
            {!isVenta && (
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
            )}

            {/* Drop zone — disponible en ambos kinds */}
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
                  {extracted ? (
                    <p className="mt-2 text-xs text-emerald-600">
                      <Sparkles className="mr-1 inline h-3 w-3" />
                      Datos extraídos. Pegá otra para reemplazar.
                    </p>
                  ) : error ? (
                    <p className="mt-2 text-xs text-rose-500">
                      No se pudo extraer. Pegá otra captura para reintentar.
                    </p>
                  ) : null}
                </>
              ) : (
                <>
                  <Sparkles className="h-6 w-6 text-[#ff007c]" />
                  <p className="text-sm font-medium text-slate-700">
                    {isVenta
                      ? 'Pegá un screenshot del cierre (Ctrl+V)'
                      : 'Click acá y pegá screenshot (Ctrl+V)'}
                  </p>
                  <p className="text-xs text-slate-500">
                    <ImageIcon className="mr-1 inline h-3 w-3" /> O subí una imagen
                    {isVenta && ' — el precio detectado se asigna a "Precio de cierre"'}
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

            {/* Campos */}
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

              {isVenta ? (
                <>
                  <div>
                    <label className={labelClass}>Precio publicado USD</label>
                    <input
                      type="number" min={0}
                      value={comparable.price ?? ''}
                      onChange={(e) => onPatch({ price: e.target.value ? Number(e.target.value) : null })}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Precio de cierre USD</label>
                    <input
                      type="number" min={0}
                      value={comparable.closing_price_usd ?? ''}
                      onChange={(e) => onPatch({ closing_price_usd: e.target.value ? Number(e.target.value) : null })}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Fecha de cierre</label>
                    <input
                      type="date"
                      value={comparable.closed_at ? comparable.closed_at.slice(0, 10) : ''}
                      onChange={(e) => onPatch({ closed_at: e.target.value || null })}
                      className={inputClass}
                    />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className={labelClass}>Precio USD</label>
                    <input
                      type="number" min={0}
                      value={comparable.price ?? ''}
                      onChange={(e) => onPatch({ price: e.target.value ? Number(e.target.value) : null })}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Días en venta</label>
                    <input
                      type="number" min={0}
                      value={comparable.days_on_market ?? ''}
                      onChange={(e) => onPatch({ days_on_market: e.target.value ? Number(e.target.value) : null })}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Vistas 30d</label>
                    <input
                      type="number" min={0}
                      value={comparable.views_per_day ?? ''}
                      onChange={(e) => onPatch({ views_per_day: e.target.value ? Number(e.target.value) : null })}
                      className={inputClass}
                    />
                  </div>
                </>
              )}

              <div>
                <label className={labelClass}>USD/m²</label>
                <input
                  type="number" min={0}
                  value={comparable.usd_per_m2 ?? ''}
                  onChange={(e) => onPatch({ usd_per_m2: e.target.value ? Number(e.target.value) : null })}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>m² total</label>
                <input
                  type="number" min={0}
                  value={comparable.total_area ?? ''}
                  onChange={(e) => onPatch({ total_area: e.target.value ? Number(e.target.value) : null })}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>m² cubierto</label>
                <input
                  type="number" min={0}
                  value={comparable.covered_area ?? ''}
                  onChange={(e) => onPatch({ covered_area: e.target.value ? Number(e.target.value) : null })}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Antigüedad</label>
                <input
                  type="number" min={0}
                  value={comparable.age ?? ''}
                  onChange={(e) => onPatch({ age: e.target.value ? Number(e.target.value) : null })}
                  className={inputClass}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </article>
  )
}
