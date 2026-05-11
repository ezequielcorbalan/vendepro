'use client'
import { useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { listVariables, updateVariable, deleteVariable } from '../shared/api'
import { isStaticBlockDefaultKey } from '../shared/static-block-defaults'
import { VariableModal } from './VariableModal'

const NAMESPACES = ['market', 'notary', 'custom'] as const

export function VariablesHome() {
  const [vars, setVars] = useState<any[] | null>(null)
  const [editing, setEditing] = useState<Record<string, string>>({})
  const [modalOpen, setModalOpen] = useState(false)

  // Las variables que guardan defaults de bloques estáticos se gestionan
  // desde la pestaña "Bloques estáticos" — las ocultamos acá para no
  // mostrar JSONs crudos en esta UI.
  const load = () =>
    listVariables().then((all: any[]) => setVars(all.filter(v => !isStaticBlockDefaultKey(v?.key))))
  useEffect(() => { load() }, [])

  const saveRow = async (id: string, value: string) => {
    try {
      await updateVariable(id, { value })
      setEditing({ ...editing, [id]: '' })
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

  if (vars === null) return (
    <div className="space-y-4">
      {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-32 animate-pulse rounded-lg bg-slate-100" />)}
    </div>
  )

  return (
    <div className="space-y-6">
      {NAMESPACES.map(ns => {
        const list = vars.filter(v => v.namespace === ns)
        return (
          <section key={ns} className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">{ns}</h2>
              {ns === 'custom' && (
                <button
                  onClick={() => setModalOpen(true)}
                  className="flex items-center gap-1 rounded bg-[#ff007c] px-3 py-1 text-xs text-white"
                >
                  <Plus className="h-3 w-3" /> Nueva
                </button>
              )}
            </div>
            {list.length === 0 && ns === 'custom' && (
              <p className="mt-3 text-sm text-slate-400">Todavía no creaste variables custom.</p>
            )}
            {list.length > 0 && (
              <table className="mt-3 w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500">
                    <th className="py-2">Key</th>
                    <th>Label</th>
                    <th>Tipo</th>
                    <th>Valor</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {list.map(v => {
                    const current = editing[v.id] !== undefined ? editing[v.id] : v.value
                    return (
                      <tr key={v.id} className="border-t border-slate-100">
                        <td className="py-2 font-mono text-xs">{v.key}</td>
                        <td>{v.label ?? '—'}</td>
                        <td className="text-xs text-slate-500">{v.value_type}</td>
                        <td>
                          <input
                            value={current}
                            onChange={e => setEditing({ ...editing, [v.id]: e.target.value })}
                            className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                          />
                        </td>
                        <td className="flex gap-1 py-2">
                          {editing[v.id] !== undefined && editing[v.id] !== v.value && (
                            <button
                              onClick={() => saveRow(v.id, current)}
                              className="rounded bg-[#ff007c] px-2 py-1 text-xs text-white"
                            >
                              Guardar
                            </button>
                          )}
                          {ns === 'custom' && !v.is_system && (
                            <button onClick={() => handleDelete(v.id)} className="text-rose-500">
                              <Trash2 className="h-3 w-3" />
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </section>
        )
      })}
      {modalOpen && <VariableModal onClose={() => setModalOpen(false)} onCreated={load} />}
    </div>
  )
}
