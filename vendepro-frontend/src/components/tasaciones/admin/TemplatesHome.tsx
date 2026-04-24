'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Copy, Archive, Edit } from 'lucide-react'
import { listTemplates, createTemplate, duplicateTemplate, archiveTemplate } from '../shared/api'

const KINDS = ['casa', 'depto', 'terreno', 'corporativo', 'custom'] as const

export function TemplatesHome() {
  const router = useRouter()
  const [templates, setTemplates] = useState<any[] | null>(null)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newKind, setNewKind] = useState<typeof KINDS[number]>('casa')

  const load = () => listTemplates().then(setTemplates)
  useEffect(() => { load() }, [])

  const handleCreate = async () => {
    if (!newName.trim()) return
    try {
      const { id } = await createTemplate({ name: newName, kind: newKind, blocks: [] })
      router.push(`/configuracion/tasacion/templates/${id}`)
    } catch (e: any) {
      alert(e?.message ?? 'Error al crear template')
    }
  }
  const handleDuplicate = async (id: string, name: string) => {
    try {
      const { id: newId } = await duplicateTemplate(id, { new_name: `${name} (copia)` })
      router.push(`/configuracion/tasacion/templates/${newId}`)
    } catch (e: any) {
      alert(e?.message ?? 'Error al duplicar template')
    }
  }
  const handleArchive = async (id: string) => {
    if (!confirm('¿Archivar este template?')) return
    try {
      await archiveTemplate(id)
      load()
    } catch (e: any) {
      alert(e?.message ?? 'Error al archivar template')
    }
  }

  if (templates === null) return <div className="grid grid-cols-1 gap-4 md:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-40 animate-pulse rounded-lg bg-slate-100" />)}</div>

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <p className="text-sm text-slate-500">{templates.length} templates</p>
        <button onClick={() => setCreating(true)} className="flex items-center gap-1 rounded bg-[#ff007c] px-3 py-2 text-sm text-white">
          <Plus className="h-4 w-4" /> Crear template
        </button>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {templates.map(t => (
          <article key={t.id} className="rounded-lg border border-slate-200 bg-white p-4">
            {t.preview_image_url && <img src={t.preview_image_url} alt="" className="mb-3 aspect-video w-full rounded object-cover" />}
            <h3 className="font-semibold">{t.name}</h3>
            <p className="mt-1 text-xs text-slate-500">{t.kind} · {(t.blocks ?? []).length} bloques {t.is_system ? '· sistema' : ''}</p>
            <div className="mt-4 flex gap-2">
              {!t.is_system && <button onClick={() => router.push(`/configuracion/tasacion/templates/${t.id}`)} className="flex items-center gap-1 rounded border border-slate-300 px-3 py-1 text-xs"><Edit className="h-3 w-3" /> Editar</button>}
              <button onClick={() => handleDuplicate(t.id, t.name)} className="flex items-center gap-1 rounded border border-slate-300 px-3 py-1 text-xs"><Copy className="h-3 w-3" /> Duplicar</button>
              {!t.is_system && <button onClick={() => handleArchive(t.id)} className="flex items-center gap-1 rounded border border-slate-300 px-3 py-1 text-xs"><Archive className="h-3 w-3" /> Archivar</button>}
            </div>
          </article>
        ))}
      </div>
      {creating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-sm rounded-lg bg-white p-6">
            <h3 className="text-lg font-semibold">Nuevo template</h3>
            <div className="mt-4 space-y-3">
              <input placeholder="Nombre" value={newName} onChange={e => setNewName(e.target.value)} className="w-full rounded border border-slate-300 px-3 py-2 text-sm" />
              <select value={newKind} onChange={e => setNewKind(e.target.value as any)} className="w-full rounded border border-slate-300 px-3 py-2 text-sm">
                {KINDS.map(k => <option key={k} value={k}>{k}</option>)}
              </select>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setCreating(false)} className="rounded px-4 py-2 text-sm">Cancelar</button>
              <button onClick={handleCreate} className="rounded bg-[#ff007c] px-4 py-2 text-sm text-white">Crear</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
