'use client'
interface Props { data: any; onPatch: (p: Record<string, unknown>) => void }

export function NotaryChartsForm({ data, onPatch }: Props) {
  return (
    <div className="space-y-3 p-3">
      <label className="flex flex-col gap-1">
        <span className="text-xs uppercase tracking-wide text-slate-600">Título</span>
        <input
          type="text"
          value={data.title ?? ''}
          maxLength={200}
          onChange={e => onPatch({ title: e.target.value })}
          className="rounded border border-slate-300 px-2 py-1 text-sm"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs uppercase tracking-wide text-slate-600">Variable del gráfico 1 (key)</span>
        <input
          type="text"
          value={data.chart_1_var ?? ''}
          placeholder="notary.sales_chart"
          onChange={e => onPatch({ chart_1_var: e.target.value })}
          className="rounded border border-slate-300 px-2 py-1 text-sm font-mono"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs uppercase tracking-wide text-slate-600">Variable del gráfico 2 (key)</span>
        <input
          type="text"
          value={data.chart_2_var ?? ''}
          placeholder="notary.semester_chart"
          onChange={e => onPatch({ chart_2_var: e.target.value })}
          className="rounded border border-slate-300 px-2 py-1 text-sm font-mono"
        />
      </label>
      <p className="text-[11px] text-slate-500">
        Las variables se definen en Configuración → Tasación → Variables (namespace <code>notary.*</code>).
      </p>
    </div>
  )
}
