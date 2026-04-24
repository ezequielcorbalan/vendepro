interface Data {
  title?: string
  map_image_url?: string | null
  neighborhood_name?: string
  min_m2_price?: number
  avg_m2_price?: number
  median_m2_price?: number
  published_count?: number
}
interface Props { data: Data; [key: `data-${string}`]: string | undefined }

export function ZoneMapBlock({ data, ...attrs }: Props) {
  return (
    <section {...attrs} className="px-6 py-10 md:px-12 md:py-16">
      <h2 className="font-poppins text-2xl font-bold md:text-3xl">{data.title ?? '¿Qué está pasando en tu zona?'}</h2>
      {data.neighborhood_name && <p className="mt-2 text-sm text-slate-600">{data.neighborhood_name}</p>}
      <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
        {data.map_image_url && <img src={data.map_image_url} alt="" className="w-full rounded-lg" />}
        <div className="space-y-3">
          {data.min_m2_price !== undefined && <div className="flex justify-between border-b py-2"><span>Mínimo USD/m²</span><span className="font-semibold">{data.min_m2_price}</span></div>}
          {data.avg_m2_price !== undefined && <div className="flex justify-between border-b py-2"><span>Promedio USD/m²</span><span className="font-semibold">{data.avg_m2_price}</span></div>}
          {data.median_m2_price !== undefined && <div className="flex justify-between border-b py-2"><span>Mediana USD/m²</span><span className="font-semibold">{data.median_m2_price}</span></div>}
          {data.published_count !== undefined && <div className="flex justify-between border-b py-2"><span>Publicadas</span><span className="font-semibold">{data.published_count}</span></div>}
        </div>
      </div>
    </section>
  )
}
