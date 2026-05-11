interface Data {
  title?: string
  // Nueva forma: imagen + nombre directos.
  chart_1_label?: string
  chart_1_image_url?: string
  chart_2_label?: string
  chart_2_image_url?: string
  // Compatibilidad con tasaciones viejas (referenciaban org-variables).
  chart_1_var?: string
  chart_2_var?: string
  vars_resolved?: Record<string, { value: string; type: string }>
}
interface Props { data: Data; [key: `data-${string}`]: string | undefined }

interface ResolvedChart {
  label: string | null
  imageUrl: string | null
  /** Fallback textual cuando la variable era de tipo texto. */
  text: string | null
  /** Key faltante (para mostrar placeholder en modo legacy). */
  missingKey: string | null
}

function resolve(
  data: Data,
  slot: 1 | 2,
): ResolvedChart {
  const label = (slot === 1 ? data.chart_1_label : data.chart_2_label) ?? null
  const directUrl = (slot === 1 ? data.chart_1_image_url : data.chart_2_image_url) ?? null
  if (directUrl) return { label, imageUrl: directUrl, text: null, missingKey: null }
  // Fallback legacy: leer de vars_resolved.
  const varKey = slot === 1 ? data.chart_1_var : data.chart_2_var
  if (!varKey) return { label, imageUrl: null, text: null, missingKey: null }
  const v = (data.vars_resolved ?? {})[varKey]
  if (!v) return { label, imageUrl: null, text: null, missingKey: varKey }
  if (v.type === 'image_url') return { label, imageUrl: v.value, text: null, missingKey: null }
  return { label, imageUrl: null, text: v.value, missingKey: null }
}

export function NotaryChartsBlock({ data, ...attrs }: Props) {
  const c1 = resolve(data, 1)
  const c2 = resolve(data, 2)

  const renderChart = (c: ResolvedChart) => (
    <div>
      {c.imageUrl && <img src={c.imageUrl} alt={c.label ?? ''} className="w-full rounded-lg" />}
      {!c.imageUrl && c.text && <p>{c.text}</p>}
      {!c.imageUrl && !c.text && c.missingKey && (
        <span className="text-amber-500">{`{{${c.missingKey}}}`}</span>
      )}
      {c.label && (
        <p className="mt-2 text-center text-sm font-medium text-slate-700">{c.label}</p>
      )}
    </div>
  )

  return (
    <section {...attrs} className="px-6 py-10 md:px-12 md:py-16">
      <h2 className="font-poppins text-2xl font-bold md:text-3xl">{data.title ?? 'Datos del Colegio de Escribanos'}</h2>
      <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
        {renderChart(c1)}
        {renderChart(c2)}
      </div>
    </section>
  )
}
