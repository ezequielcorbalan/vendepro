'use client'
import { useEffect, useState } from 'react'
import { Plus, Trash2, Sparkles } from 'lucide-react'
import { listVariables, updateVariable, deleteVariable, createVariable } from '../shared/api'
import { VariableModal } from './VariableModal'

type Namespace = 'market' | 'notary' | 'custom'

const NAMESPACES: { key: Namespace; label: string; description: string }[] = [
  {
    key: 'market',
    label: 'Estadísticas de mercado',
    description:
      'Valores que aparecen en el bloque "Estadísticas de mercado" (propiedades en venta, vendidas, tasa de conversión, período de referencia).',
  },
  {
    key: 'notary',
    label: 'Datos del Colegio de Escribanos',
    description:
      'Imágenes o gráficos que aparecen en el bloque "Gastos e impuestos" (escrituras del semestre, ventas mensuales, etc.).',
  },
  {
    key: 'custom',
    label: 'Variables personalizadas',
    description:
      'Valores propios de tu inmobiliaria que querés reutilizar en cualquier bloque (textos, links, datos institucionales).',
  },
]

const VALUE_TYPE_LABELS: Record<string, string> = {
  number: 'Número',
  percent: 'Porcentaje',
  text: 'Texto',
  date: 'Fecha',
  image_url: 'Imagen',
}

// Variables que los templates de sistema esperan en cada namespace.
// Si el namespace está vacío, ofrecemos crearlas en un click.
const SUGGESTED_VARS: Record<Exclude<Namespace, 'custom'>, { key: string; label: string; value_type: string }[]> = {
  market: [
    { key: 'market.properties_on_sale', label: 'Propiedades en venta', value_type: 'number' },
    { key: 'market.properties_sold',    label: 'Propiedades vendidas', value_type: 'number' },
    { key: 'market.conversion_rate',    label: 'Tasa de conversión',   value_type: 'percent' },
    { key: 'market.reference_period',   label: 'Período de referencia', value_type: 'text' },
  ],
  notary: [
    { key: 'notary.sales_chart',    label: 'Ventas por mes',     value_type: 'image_url' },
    { key: 'notary.semester_chart', label: 'Ventas por semestre', value_type: 'image_url' },
  ],
}

export function VariablesHome() {
  const [vars, setVars] = useState<any[] | null>(null)
  const [editing, setEditing] = useState<Record<string, string>>({})
  const [modalNs, setModalNs] = useState<Namespace | null>(null)
  const [seeding, setSeeding] = useState<string | null>(null)

  const load = () => listVariables().then(setVars)
  useEffect(() => { load() }, [])

  const saveRow = async (id: string, value: string) => {
    try {
      await updateVariable(id, { value })
      setEditing(e => { const next = { ...e }; delete next[id]; return next })
      load()
    } catch (e: any) {
      alert(e?.message ?? 'Error al guardar variable')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar variable?')) return
    try {
      await deleteVariable(id)
      load()
    } catch (e: any) {
      alert(e?.message ?? 'Error al eliminar variable')
    }
  }

  const seedSuggested = async (ns: 'market' | 'notary') => {
    setSeeding(ns)
    try {
      const suggested = SUGGESTED_VARS[ns]
      for (const s of suggested) {
        await createVariable({
          key: s.key,
          label: s.label,
          value: '',
          value_type: s.value_type,
          namespace: ns,
        })
      }
      load()
    } catch (e: any) {
      alert(e?.message ?? 'Error al crear variables sugeridas')
    } finally {
      setSeeding(null)
    }
  }

  if (vars === null) return (
    <div className="space-y-4">
      {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-32 animate-pulse rounded-lg bg-slate-100" />)}
    </div>
  )

  return (
    <div className="space-y-6">
      {NAMESPACES.map(({ key: ns, label, description }) => {
        const list = vars.filter(v => v.namespace === ns)
        const canSeed = (ns === 'market' || ns === 'notary') && list.length === 0

        return (
          <section key={ns} className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">{label}</h2>
                <p className="mt-1 text-xs text-slate-500">{description}</p>
              </div>
              <button
                onClick={() => setModalNs(ns)}
                className="flex items-center gap-1 rounded bg-[#ff007c] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
              >
                <Plus className="h-3.5 w-3.5" /> Nueva
              </button>
            </div>

            {list.length === 0 ? (
              <div className="mt-4 rounded-lg border border-dashed border-slate-300 px-4 py-6 text-center">
                {canSeed ? (
                  <>
                    <p className="text-sm text-slate-500">
                      Todavía no hay variables en este namespace.
                    </p>
                    <button
                      onClick={() => seedSuggested(ns)}
                      disabled={seeding === ns}
                      className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-[#ff007c] px-3 py-1.5 text-xs font-medium text-[#ff007c] hover:bg-[#ff007c]/5 disabled:opacity-40"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      {seeding === ns ? 'Creando...' : `Crear las variables sugeridas (${SUGGESTED_VARS[ns].length})`}
                    </button>
                    <p className="mt-2 text-xs text-slate-400">
                      Son las que ya usan los templates del sistema. Después podés editar sus valores.
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-slate-500">
                    Todavía no creaste variables personalizadas. Usá <strong>+ Nueva</strong> para sumar la primera.
                  </p>
                )}
              </div>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      <th className="py-2 pr-3">Variable</th>
                      <th className="pr-3">Etiqueta</th>
                      <th className="pr-3">Tipo</th>
                      <th className="pr-3">Valor</th>
                      <th className="w-20"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map(v => {
                      const current = editing[v.id] !== undefined ? editing[v.id] : (v.value ?? '')
                      const dirty = editing[v.id] !== undefined && editing[v.id] !== (v.value ?? '')
                      return (
                        <tr key={v.id} className="border-t border-slate-100 align-middle">
                          <td className="py-2 pr-3 font-mono text-xs text-slate-600">{v.key}</td>
                          <td className="pr-3 text-sm text-slate-800">{v.label ?? '—'}</td>
                          <td className="pr-3 text-xs text-slate-500">
                            {VALUE_TYPE_LABELS[v.value_type] ?? v.value_type}
                          </td>
                          <td className="pr-3">
                            <input
                              value={current}
                              onChange={e => setEditing({ ...editing, [v.id]: e.target.value })}
                              placeholder={v.value_type === 'image_url' ? 'https://...' : 'Sin valor'}
                              className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                            />
                          </td>
                          <td className="py-2">
                            <div className="flex gap-1">
                              {dirty && (
                                <button
                                  onClick={() => saveRow(v.id, current)}
                                  className="rounded bg-[#ff007c] px-2 py-1 text-xs text-white"
                                >
                                  Guardar
                                </button>
                              )}
                              {ns === 'custom' && !v.is_system && (
                                <button
                                  onClick={() => handleDelete(v.id)}
                                  className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-500"
                                  title="Eliminar"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )
      })}
      {modalNs && (
        <VariableModal
          namespace={modalNs}
          onClose={() => setModalNs(null)}
          onCreated={load}
        />
      )}
    </div>
  )
}
