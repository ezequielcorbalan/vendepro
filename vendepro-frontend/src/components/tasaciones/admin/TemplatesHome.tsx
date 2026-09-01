'use client'
import { useToast } from '@/components/ui/Toast'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Copy, Archive, Edit } from 'lucide-react'
import { listTemplates, createTemplate, duplicateTemplate, archiveTemplate } from '../shared/api'
import { getCurrentUser } from '@/lib/auth'
import { Field, Input, Select } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Card, CardTitle } from '@/components/ui/Card'
import { Text } from '@/components/ui/Typography'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Modal } from '@/components/ui/Modal'
import { TEMPLATE_SCOPES, getTemplateScope } from '@/lib/crm-config'

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

  if (templates === null) return <div className="grid grid-cols-1 gap-4 md:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-40 animate-pulse rounded-card bg-gray-100" />)}</div>

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <p className="text-sm text-gray-500">{templates.length} templates</p>
        <Button onClick={() => setCreating(true)} icon={<Plus className="h-4 w-4" />}>
          Crear template
        </Button>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {templates.map(t => {
          const isOwn = t.agent_id && t.agent_id === user?.id
          const canEdit = !t.is_system && (!t.agent_id || isOwn || isAdmin)
          const canArchive = !t.is_system && (!t.agent_id || isOwn || isAdmin)
          const scope = TEMPLATE_SCOPES[getTemplateScope(t, user?.id)]

          // El borde rosa para "es mío" se fue: la pertenencia ya la dice el
          // badge, y un borde de color en la card la hace competir con las demás
          // sin significar un estado.
          return (
            <Card key={t.id} padded={false} className="p-4">
              {t.preview_image_url && <img src={t.preview_image_url} alt="" className="mb-3 aspect-video w-full rounded-control object-cover" />}
              <div className="flex items-center gap-2">
                <CardTitle className="truncate">{t.name}</CardTitle>
                <StatusBadge size="sm" label={scope.label} color={scope.color} className="shrink-0" />
              </div>
              <Text size="xs" tone="muted" className="block mt-1">{t.kind} · {(t.blocks ?? []).length} bloques</Text>
              <div className="mt-4 flex flex-wrap gap-2">
                {canEdit && (
                  <Button variant="outline" size="sm" onClick={() => router.push(`/configuracion/tasacion/templates/${t.id}`)} icon={<Edit className="h-3 w-3" />}>
                    Editar
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={() => handleDuplicate(t.id, t.name)} icon={<Copy className="h-3 w-3" />}>
                  Duplicar
                </Button>
                {canArchive && (
                  <Button variant="outline" size="sm" onClick={() => handleArchive(t.id)} icon={<Archive className="h-3 w-3" />}>
                    Archivar
                  </Button>
                )}
              </div>
            </Card>
          )
        })}
      </div>
      {/* Era un overlay + panel armados a mano: sin Esc, sin click afuera y sin
          el z-index del DS. */}
      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title="Nuevo template"
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreating(false)}>Cancelar</Button>
            <Button onClick={handleCreate}>Crear</Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Nombre">
            <Input placeholder="Nombre" value={newName} onChange={e => setNewName(e.target.value)} />
          </Field>
          <Field label="Tipo">
            <Select value={newKind} onChange={e => setNewKind(e.target.value as any)}>
              {KINDS.map(k => <option key={k} value={k}>{k}</option>)}
            </Select>
          </Field>
        </div>
      </Modal>
    </div>
  )
}
