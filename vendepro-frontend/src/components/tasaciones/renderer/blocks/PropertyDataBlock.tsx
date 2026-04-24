interface PropertyData {
  title?: string
  property_address?: string
  neighborhood?: string | null
  city?: string | null
  property_type?: string | null
  covered_area?: number | null
  total_area?: number | null
  semi_area?: number | null
  weighted_area?: number | null
}

interface Props {
  data: PropertyData
  [key: `data-${string}`]: string | undefined
}

export function PropertyDataBlock({ data, ...attrs }: Props) {
  const rows: { label: string; value: string | number | null | undefined }[] = [
    { label: 'Dirección', value: data.property_address },
    { label: 'Barrio', value: data.neighborhood },
    { label: 'Ciudad', value: data.city },
    { label: 'Tipología', value: data.property_type },
    { label: 'Superficie cubierta (m²)', value: data.covered_area },
    { label: 'Superficie total (m²)', value: data.total_area },
    { label: 'Semicubierta (m²)', value: data.semi_area },
    { label: 'Ponderada (m²)', value: data.weighted_area },
  ]
  return (
    <section {...attrs} className="px-6 py-10 md:px-12 md:py-16">
      <h2 className="font-poppins text-2xl font-bold md:text-3xl">{data.title ?? 'Datos de la propiedad'}</h2>
      <dl className="mt-6 grid grid-cols-1 gap-y-3 md:grid-cols-2 md:gap-x-8">
        {rows.filter(r => r.value !== null && r.value !== undefined && r.value !== '').map(r => (
          <div key={r.label} className="flex justify-between border-b border-slate-200 py-2">
            <dt className="text-sm text-slate-600">{r.label}</dt>
            <dd className="text-sm font-semibold text-slate-900">{r.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
