interface WorkConditionsData {
  title?: string
  honorarios_pct?: number
  exclusividad_dias?: number
  required_docs?: string[]
  extras?: string[]
  legal_text?: string
  signature_image_url?: string | null
}

interface Props {
  data: WorkConditionsData
  [key: `data-${string}`]: string | undefined
}

export function WorkConditionsBlock({ data, ...attrs }: Props) {
  return (
    <section {...attrs} className="px-6 py-10 md:px-12 md:py-16">
      <h2 className="font-poppins text-2xl font-bold md:text-3xl">{data.title ?? 'Condiciones de trabajo'}</h2>
      <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="rounded-lg bg-slate-50 p-5">
          <p className="text-xs uppercase tracking-wide text-slate-500">Honorarios</p>
          <p className="mt-1 text-4xl font-bold text-slate-900">{data.honorarios_pct ?? 3}%</p>
          <p className="mt-4 text-xs uppercase tracking-wide text-slate-500">Exclusividad</p>
          <p className="mt-1 text-xl font-semibold text-slate-900">{data.exclusividad_dias ?? 120} días</p>
        </div>
        <div>
          {data.required_docs && data.required_docs.length > 0 && (
            <>
              <p className="text-sm font-semibold text-slate-700">Documentación requerida</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
                {data.required_docs.map((d, i) => <li key={i}>{d}</li>)}
              </ul>
            </>
          )}
          {data.extras && data.extras.length > 0 && (
            <>
              <p className="mt-4 text-sm font-semibold text-slate-700">Adicionales</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
                {data.extras.map((d, i) => <li key={i}>{d}</li>)}
              </ul>
            </>
          )}
        </div>
      </div>
      {data.legal_text && (
        <p className="mt-6 border-t border-slate-200 pt-4 text-xs text-slate-500">{data.legal_text}</p>
      )}
      {data.signature_image_url && (
        <img src={data.signature_image_url} alt="Firma" className="mt-6 h-16 w-auto" />
      )}
    </section>
  )
}
