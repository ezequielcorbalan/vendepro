interface Data {
  title?: string
  chart_1_var?: string
  chart_2_var?: string
  vars_resolved?: Record<string, { value: string; type: string }>
}
interface Props { data: Data; [key: `data-${string}`]: string | undefined }

export function NotaryChartsBlock({ data, ...attrs }: Props) {
  const resolved = data.vars_resolved ?? {}
  const c1 = data.chart_1_var ? resolved[data.chart_1_var] : undefined
  const c2 = data.chart_2_var ? resolved[data.chart_2_var] : undefined
  const renderChart = (v: typeof c1, key?: string) => {
    if (!v) return <span className="text-amber-500">{`{{${key ?? 'chart'}}}`}</span>
    if (v.type === 'image_url') return <img src={v.value} alt="" className="w-full rounded-lg" />
    return <p>{v.value}</p>
  }
  return (
    <section {...attrs} className="px-6 py-10 md:px-12 md:py-16">
      <h2 className="font-poppins text-2xl font-bold md:text-3xl">{data.title ?? 'Datos del Colegio de Escribanos'}</h2>
      <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
        <div>{renderChart(c1, data.chart_1_var)}</div>
        <div>{renderChart(c2, data.chart_2_var)}</div>
      </div>
    </section>
  )
}
