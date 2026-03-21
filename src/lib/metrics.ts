// Shared metric computation — works on server and client

export interface MetricTotals {
  impressions: number
  portal_visits: number
  inquiries: number
  phone_calls?: number
  whatsapp?: number
  in_person_visits: number
  offers: number
  ranking_position?: number | null
}

export interface MetricItemData {
  label: string
  value: number | string
  iconName: string
  color: string
}

export function buildMetricItemsData(totals: MetricTotals): MetricItemData[] {
  const items: MetricItemData[] = [
    { label: 'Impresiones', value: totals.impressions.toLocaleString('es-AR'), iconName: 'Eye', color: '#6366f1' },
    { label: 'Visitas al aviso', value: totals.portal_visits.toLocaleString('es-AR'), iconName: 'MousePointerClick', color: '#ff007c' },
    { label: 'Consultas', value: totals.inquiries, iconName: 'MessageCircle', color: '#ff8017' },
    { label: 'Visitas presenciales', value: totals.in_person_visits, iconName: 'Users', color: '#10b981' },
  ]

  if (totals.phone_calls) {
    items.push({ label: 'Llamadas', value: totals.phone_calls, iconName: 'Phone', color: '#8b5cf6' })
  }
  if (totals.whatsapp) {
    items.push({ label: 'WhatsApp', value: totals.whatsapp, iconName: 'MessageCircle', color: '#22c55e' })
  }
  if (totals.offers) {
    items.push({ label: 'Ofertas', value: totals.offers, iconName: 'TrendingUp', color: '#f59e0b' })
  }
  if (totals.ranking_position) {
    items.push({ label: 'Ranking zona', value: `#${totals.ranking_position}`, iconName: 'Award', color: '#ef4444' })
  }

  return items
}
