'use client'
import { Building2, MapPin, Calendar } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { PropertyStageBadge } from '@/components/ui/PropertyStageBadge'
import type { ComparableData } from './ComparableCard'
import {
  ComparablePickerModal, formatPriceUsd, formatPickerDate,
  type ComparableSource,
} from './ComparablePickerModal'

interface PropertyLite {
  id: string
  address: string
  neighborhood?: string | null
  property_type?: string | null
  size_m2?: number | null
  asking_price?: number | null
  currency?: string | null
  commercial_stage?: string | null
  owner_name?: string | null
  agent_name?: string | null
  updated_at?: string | null
}

interface Props {
  open: boolean
  onClose: () => void
  /** Se invoca con los datos ya mapeados a un comparable (kind según stage). */
  onPick: (data: ComparableData) => void
}

/**
 * Mapea una propiedad del CRM → ComparableData. Si la propiedad está en
 * stage 'vendida', se trata como cierre real (kind='venta', asking_price
 * pasa a closing_price_usd y updated_at a closed_at). En otros estados
 * cuenta como publicación (asking_price → price).
 */
export function mapPropertyToComparable(p: PropertyLite): ComparableData {
  const isVendida = (p.commercial_stage ?? '').toLowerCase() === 'vendida'
  const usdPrice = (p.currency && p.currency !== 'USD') ? null : (p.asking_price ?? null)
  return {
    kind: isVendida ? 'venta' : 'publicacion',
    address: p.address,
    total_area: p.size_m2 ?? null,
    covered_area: null,
    price: isVendida ? null : usdPrice,
    closing_price_usd: isVendida ? usdPrice : null,
    closed_at: isVendida ? (p.updated_at ?? null) : null,
    usd_per_m2: null,
    age: null,
    days_on_market: null,
    views_per_day: null,
    zonaprop_url: null,
    source_sold_property_id: null,
  }
}

/** Sólo lo propio de esta fuente: la pantalla vive en ComparablePickerModal. */
const fuente: ComparableSource<PropertyLite> = {
  title: 'Elegir desde una propiedad cargada',
  icon: <Building2 className="w-5 h-5" />,
  searchPlaceholder: 'Buscar dirección, barrio, dueño…',
  filters: [{
    key: 'stage',
    placeholder: 'Estado: cualquiera',
    kind: 'select',
    options: [
      { value: 'propuesta', label: 'Propuestas' },
      { value: 'captada', label: 'Captadas' },
      { value: 'publicada', label: 'Publicadas' },
      { value: 'reservada', label: 'Reservadas' },
      { value: 'vendida', label: 'Solo vendidas (cierres reales)' },
      { value: 'perdida', label: 'Perdidas' },
    ],
  }],
  hint: (
    <>
      Las propiedades en estado <strong>vendida</strong> se agregan como cierre real;
      el resto como publicación.
    </>
  ),
  load: async () => {
    const data = (await (await apiFetch('properties', '/properties')).json()) as any
    return Array.isArray(data) ? data : Array.isArray(data?.properties) ? data.properties : []
  },
  rowKey: p => p.id,
  searchable: p => [p.address, p.neighborhood, p.property_type, p.owner_name, p.agent_name]
    .filter(Boolean).join(' '),
  matches: (p, f) => !f.stage || (p.commercial_stage ?? '').toLowerCase() === f.stage,
  toRow: p => {
    const stage = (p.commercial_stage ?? '').toLowerCase()
    const isVendida = stage === 'vendida'
    return {
      title: p.address,
      badge: stage
        ? <PropertyStageBadge stage={stage} className="text-[10px] px-2 py-0.5 whitespace-nowrap" />
        : undefined,
      meta: [
        p.neighborhood && <><MapPin className="h-3 w-3" /> {p.neighborhood}</>,
        p.property_type,
        typeof p.size_m2 === 'number' && `${p.size_m2} m²`,
        isVendida && p.updated_at && <><Calendar className="h-3 w-3" /> {formatPickerDate(p.updated_at)}</>,
      ].filter(Boolean) as React.ReactNode[],
      amountLabel: isVendida ? 'Cierre' : 'Listado',
      amount: formatPriceUsd(p.asking_price),
    }
  },
  toComparable: mapPropertyToComparable,
  emptyTitle: 'No tenés propiedades cargadas todavía.',
  emptyFiltered: 'Ninguna propiedad coincide con los filtros.',
}

export function PropertiesPickerModal({ open, onClose, onPick }: Props) {
  return <ComparablePickerModal open={open} onClose={onClose} onPick={onPick} source={fuente} />
}
