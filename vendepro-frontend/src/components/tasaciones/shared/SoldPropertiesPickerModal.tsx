'use client'
import { Database, MapPin, Calendar } from 'lucide-react'
import {
  listSoldProperties,
  PROPERTY_TYPES,
  type SoldProperty,
} from '@/lib/sold-properties/api'
import type { ComparableData } from './ComparableCard'
import {
  ComparablePickerModal, formatPriceUsd, formatPickerDate,
  type ComparableSource,
} from './ComparablePickerModal'

interface Props {
  open: boolean
  onClose: () => void
  /** Se invoca con los datos ya mapeados a un comparable de tipo 'venta'. */
  onPick: (data: ComparableData) => void
}

/**
 * Mapea un sold_property → ComparableData (kind='venta'). El backend recibe
 * el dato luego y guarda `source_sold_property_id` para trazabilidad.
 */
export function mapSoldPropertyToComparable(sp: SoldProperty): ComparableData {
  return {
    kind: 'venta',
    address: sp.address_approx ?? sp.neighborhood ?? null,
    total_area: sp.total_area ?? null,
    covered_area: sp.covered_area ?? null,
    price: sp.listing_price_usd ?? null,
    closing_price_usd: sp.closing_price_usd ?? null,
    closed_at: sp.closed_at ?? null,
    usd_per_m2: sp.usd_per_m2 ?? null,
    age: null,
    days_on_market: null,
    views_per_day: null,
    zonaprop_url: null,
    source_sold_property_id: sp.id,
  }
}

/** Sólo lo propio de esta fuente: la pantalla vive en ComparablePickerModal. */
const fuente: ComparableSource<SoldProperty> = {
  title: 'Elegir desde Cierres Reales',
  icon: <Database className="w-5 h-5" />,
  searchPlaceholder: 'Buscar…',
  // Estos dos SÍ van al servidor: `listSoldProperties` los recibe y filtra allá.
  filters: [
    {
      key: 'property_type',
      placeholder: 'Tipo: cualquiera',
      kind: 'select',
      server: true,
      options: PROPERTY_TYPES.map(t => ({ value: t.value, label: t.label })),
    },
    { key: 'neighborhood', placeholder: 'Barrio', kind: 'text', server: true },
  ],
  load: filtros => listSoldProperties({
    property_type: filtros.property_type || undefined,
    neighborhood: filtros.neighborhood || undefined,
  }),
  rowKey: sp => sp.id,
  searchable: sp => [
    sp.address_approx, sp.neighborhood, sp.property_type, sp.notes,
    sp.external_agent_name, sp.external_agency,
  ].filter(Boolean).join(' '),
  toRow: sp => ({
    title: sp.address_approx || sp.neighborhood || sp.property_type,
    badge: (
      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] uppercase tracking-wide text-gray-600">
        {sp.property_type}
      </span>
    ),
    meta: [
      sp.neighborhood && <><MapPin className="h-3 w-3" /> {sp.neighborhood}</>,
      (sp.covered_area || sp.total_area) && `${sp.covered_area ?? sp.total_area} m²`,
      sp.closed_at && <><Calendar className="h-3 w-3" /> {formatPickerDate(sp.closed_at)}</>,
    ].filter(Boolean) as React.ReactNode[],
    amountLabel: 'Cierre',
    amount: formatPriceUsd(sp.closing_price_usd),
  }),
  toComparable: mapSoldPropertyToComparable,
  emptyTitle: 'No tenés cierres reales cargados todavía.',
  emptyDescription: 'Podés cargar cierres desde Tasaciones → Cierres Reales.',
  emptyFiltered: 'Ningún cierre coincide con los filtros.',
}

export function SoldPropertiesPickerModal({ open, onClose, onPick }: Props) {
  return <ComparablePickerModal open={open} onClose={onClose} onPick={onPick} source={fuente} />
}
