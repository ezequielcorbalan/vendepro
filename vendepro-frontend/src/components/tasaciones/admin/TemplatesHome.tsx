'use client'
import { useToast } from '@/components/ui/Toast'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Copy, Archive, Edit, User } from 'lucide-react'
import { listTemplates, createTemplate, duplicateTemplate, archiveTemplate } from '../shared/api'
import { getCurrentUser } from '@/lib/auth'
import { Field, Input, Select } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'

const KINDS = ['casa', 'depto', 'terreno', 'corporativo', 'custom'] as const

export function TemplatesHome() {
  const { toast } = useToast()
  const router = useRouter()
  const user = getCurrentUser()
  const isAdmin = user?.role === 'admin'
  const [templates, setTemplates] = useState<any[] | null>(null)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newKind, setNewKind] = useState<typeof KINDS[number]>('casa')

  const load = () => listTemplates({ active: true }).then(setTemplates).catch(() => setTemplates([]))
  useEffect(() => {
    load()
    const onFocus = () => load()
    const onVisibility = () => { if (document.visibilityState === 'visible') load() }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  const handleCreate = async () => {
    if (!newName.trim()) return
    try {
      const { id } = await createTemplate({ name: newName, kind: newKind, blocks: [] })
      router.push(`/configuracion/tasacion/templates/${id}`)
    } catch (e: any) {
      toast(e?.message ?? 'Error al crear template', 'error')
    }
  }
  const handleDuplicate = async (id: string, name: string) => {
    try {
      const { id: newId } = await duplicateTemplate(id, { new_name: `${name} (copia)` })
      router.push(`/configuracion/tasacion/templates/${newId}`)
    } catch (e: any) {
      toast(e?.message ?? 'Error al duplicar template', 'error')
    }
  }
  const handleArchive = async (id: string) => {
    if (!confirm('¿Archivar este template?')) return
    try {
      await archiveTemplate(id)
      load()
    } catch (e: any) {
      toast(e?.message ?? 'Error al archivar template', 'error')
    }
  }

  if (templates === null) return <div className="grid grid-cols-1 gap-4 md:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-40 animate-pulse rounded-lg bg-gray-100" />)}</div>

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <p className="text-sm text-gray-500">{templates.length} templates</p>
        <button onClick={() => setCreating(true)} className="flex items-center gap-1 rounded-control bg-primary hover:bg-primary-hover px-3 py-2 text-sm text-white">
          <Plus className="h-4 w-4" /> Crear template
        </button>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {templates.map(t => {
          const isOwn = t.agent_id && t.agent_id === user?.id
          const canEdit = !t.is_system && (!t.agent_id || isOwn || isAdmin)
          const canArchive = !t.is_system && (!t.agent_id || isOwn || isAdmin)
          // Non-admins can't edit org-level templates, only their own
          const canEditFull = canEdit && (isAdmin || isOwn || !t.agent_id === false)
          const ownerBadge = t.is_system
            ? 'Sistema'
            : t.agent_id
              ? (isOwn ? 'Mío' : 'Agente')
              : 'Organización'
          const badgeColor = t.is_system
            ? 'bg-gray-100 text-gray-600'
            : t.agent_id
              ? (isOwn ? 'bg-pink-100 text-pink-800' : 'bg-purple-100 text-purple-800')
              : 'bg-blue-100 text-blue-800'

          return (
            <article key={t.id} className={`rounded-lg border bg-white p-4 ${isOwn ? 'border-pink-200' : 'border-gray-200'}`}>
              {t.preview_image_url && <img src={t.preview_image_url} alt="" className="mb-3 aspect-video w-full rounded object-cover" />}
              <div className="flex items-center gap-2">
                <h3 className="font-semibold truncate">{t.name}</h3>
                <span className={`shrink-0 text-[10px] px-2 py-0.5 rounded-full font-medium ${badgeColor}`}>{ownerBadge}</span>
              </div>
              <p className="mt-1 text-xs text-gray-500">{t.kind} · {(t.blocks ?? []).length} bloques</p>
              <div className="mt-4 flex gap-2">
                {canEdit && <button onClick={() => router.push(`/configuracion/tasacion/templates/${t.id}`)} className="flex items-center gap-1 rounded border border-gray-300 px-3 py-1 text-xs hover:bg-gray-50"><Edit className="h-3 w-3" /> Editar</button>}
                <button onClick={() => handleDuplicate(t.id, t.name)} className="flex items-center gap-1 rounded border border-gray-300 px-3 py-1 text-xs hover:bg-gray-50"><Copy className="h-3 w-3" /> Duplicar</button>
                {canArchive && <button onClick={() => handleArchive(t.id)} className="flex items-center gap-1 rounded border border-gray-300 px-3 py-1 text-xs hover:bg-gray-50"><Archive className="h-3 w-3" /> Archivar</button>}
              </div>
            </article>
          )
        })}
      </div>
      {creating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-sm rounded-lg bg-white p-6">
            <h3 className="text-lg font-semibold">Nuevo template</h3>
            <div className="mt-4 space-y-3">
              <Field label="Nombre">
                <Input placeholder="Nombre" value={newName} onChange={e => setNewName(e.target.value)} />
              </Field>
              <Field label="Tipo">
                <Select value={newKind} onChange={e => setNewKind(e.target.value as any)}>
                  {KINDS.map(k => <option key={k} value={k}>{k}</option>)}
                </Select>
              </Field>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setCreating(false)}>Cancelar</Button>
              <Button onClick={handleCreate}>Crear</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
