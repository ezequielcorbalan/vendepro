'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Users, Plus, Trash2, Trash, Loader2, Mail, Phone, Check, ChevronDown, Pencil, RotateCcw, UserPlus } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { getCurrentUser } from '@/lib/auth'
import { getRoleLabel, getRoleColor } from '@/lib/crm-config'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Modal } from '@/components/ui/Modal'
import { Tabs } from '@/components/ui/Tabs'
import { Avatar } from '@/components/ui/Avatar'
import { useConfirm } from '@/components/ui/useConfirm'
import { Field, Input, Select } from '@/components/ui/Input'
import { Text } from '@/components/ui/Typography'

interface Role {
  id: number
  name: string
  label: string
}

const EMPTY_FORM = { full_name: '', email: '', password: '', role: 'agent', phone: '' }

function formatDeletedAt(value?: string | null): string | null {
  if (!value) return null
  // El backend guarda UTC (datetime('now')); SQLite no incluye la Z.
  const iso = value.includes('T') ? value : value.replace(' ', 'T') + 'Z'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return null
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function AgentesPage() {
  const { toast } = useToast()
  const { confirmDialog, askConfirm } = useConfirm()
  const [tab, setTab] = useState<'activos' | 'papelera'>('activos')
  const [agents, setAgents] = useState<any[]>([])
  const [deleted, setDeleted] = useState<any[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [editing, setEditing] = useState<any | null>(null)
  const [saving, setSaving] = useState(false)
  const [restoringId, setRestoringId] = useState<string | null>(null)
  const [changingRole, setChangingRole] = useState<string | null>(null)
  const [updatingRoleId, setUpdatingRoleId] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [editForm, setEditForm] = useState({ full_name: '', email: '', phone: '', password: '' })
  const currentUser = getCurrentUser()

  function loadAgents() {
    apiFetch('admin', '/agents')
      .then(r => r.json() as Promise<any>)
      .then(d => { setAgents(Array.isArray(d) ? d : (d.agents || [])); setLoading(false) })
      .catch(() => setLoading(false))
  }

  function loadDeleted() {
    apiFetch('admin', '/agents/deleted')
      .then(r => r.json() as Promise<any>)
      .then(d => { if (Array.isArray(d)) setDeleted(d) })
      .catch(() => {})
  }

  function loadRoles() {
    apiFetch('admin', '/roles')
      .then(r => r.json() as Promise<any>)
      .then(d => { if (Array.isArray(d)) setRoles(d) })
      .catch(() => {})
  }

  useEffect(() => {
    loadAgents()
    loadDeleted()
    loadRoles()
  }, [])

  useEffect(() => {
    if (!changingRole) return
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('[data-role-popover]')) setChangingRole(null)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [changingRole])

  async function handleCreate() {
    if (!form.full_name || !form.email || !form.password) return
    setSaving(true)
    try {
      const res = await apiFetch('admin', '/create-agent', {
        method: 'POST',
        body: JSON.stringify(form),
      })
      const data = (await res.json()) as any
      if (data.id || data.success) {
        toast('Agente creado')
        setShowCreate(false)
        setForm(EMPTY_FORM)
        loadAgents()
      } else {
        toast(data.error || 'Error al crear agente', 'error')
      }
    } catch { toast('Error de conexión', 'error') }
    setSaving(false)
  }

  function openEdit(agent: any) {
    setEditForm({
      full_name: agent.full_name || '',
      email: agent.email || '',
      phone: agent.phone || '',
      password: '',
    })
    setEditing(agent)
  }

  async function handleEdit() {
    if (!editing || !editForm.full_name || !editForm.email) return
    setSaving(true)
    try {
      const res = await apiFetch('admin', `/agents/${editing.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          full_name: editForm.full_name,
          email: editForm.email,
          phone: editForm.phone || null,
          // Vacío = no cambiar la contraseña.
          ...(editForm.password ? { password: editForm.password } : {}),
        }),
      })
      const data = (await res.json()) as any
      if (data.success) {
        toast(editForm.password ? 'Agente actualizado y contraseña cambiada' : 'Agente actualizado')
        setEditing(null)
        loadAgents()
      } else {
        toast(data.error || 'Error al guardar', 'error')
      }
    } catch { toast('Error de conexión', 'error') }
    setSaving(false)
  }

  async function handleDelete(agent: any) {
    if (agent.id === currentUser?.id) { toast('No podés eliminarte a vos mismo', 'warning'); return }
    const { confirmed } = await askConfirm({
      title: 'Eliminar agente',
      message: `"${agent.full_name}" va a la papelera y pierde el acceso a la app.\n\nSus leads, tasaciones y actividad se conservan, y podés restaurarlo cuando quieras.`,
      confirmLabel: 'Eliminar',
      variant: 'danger',
    })
    if (!confirmed) return
    try {
      const res = await apiFetch('admin', `/agents?id=${agent.id}`, { method: 'DELETE' })
      const data = (await res.json()) as any
      if (data.success) {
        toast('Agente movido a la papelera', 'warning')
        loadAgents()
        loadDeleted()
      } else {
        toast(data.error || 'Error al eliminar', 'error')
      }
    } catch { toast('Error al eliminar', 'error') }
  }

  async function handleRestore(agent: any) {
    setRestoringId(agent.id)
    try {
      const res = await apiFetch('admin', `/agents/${agent.id}/restore`, { method: 'POST' })
      const data = (await res.json()) as any
      if (data.success) {
        toast('Agente restaurado')
        loadAgents()
        loadDeleted()
      } else {
        toast(data.error || 'Error al restaurar', 'error')
      }
    } catch { toast('Error de conexión', 'error') }
    setRestoringId(null)
  }

  async function handleRoleChange(agentId: string, roleId: number, roleName: string) {
    if (updatingRoleId) return
    setChangingRole(null)
    setUpdatingRoleId(agentId)
    const prev = agents.find(a => a.id === agentId)?.role
    setAgents(list => list.map(a => a.id === agentId ? { ...a, role: roleName } : a))
    try {
      const res = await apiFetch('admin', '/agents/role', {
        method: 'PATCH',
        body: JSON.stringify({ id: agentId, role_id: roleId }),
      })
      const data = (await res.json()) as any
      if (!data.success) {
        setAgents(list => list.map(a => a.id === agentId ? { ...a, role: prev } : a))
        toast(data.error || 'Error al cambiar rol', 'error')
      } else {
        toast('Rol actualizado')
      }
    } catch {
      setAgents(list => list.map(a => a.id === agentId ? { ...a, role: prev } : a))
      toast('Error de conexión', 'error')
    } finally {
      setUpdatingRoleId(null)
    }
  }

  return (
    <div>
      {confirmDialog}

      <PageHeader
        className="mb-4"
        title="Equipo"
        subtitle={`${agents.length} agente${agents.length !== 1 ? 's' : ''} activo${agents.length !== 1 ? 's' : ''}`}
        actions={
          <>
            <Link href="/admin/objetivos" className="inline-flex items-center bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-control text-sm font-medium hover:bg-gray-50">
              Objetivos
            </Link>
            <Button onClick={() => setShowCreate(true)} icon={<Plus className="w-4 h-4" />}>
              Nuevo agente
            </Button>
          </>
        }
      />

      <Tabs
        className="mb-5"
        value={tab}
        onChange={v => setTab(v as 'activos' | 'papelera')}
        items={[
          { value: 'activos', label: 'Activos', count: agents.length, icon: <Users className="w-4 h-4" /> },
          { value: 'papelera', label: 'Papelera', count: deleted.length, icon: <Trash className="w-4 h-4" /> },
        ]}
      />

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
      ) : tab === 'activos' ? (
        agents.length === 0 ? (
          <EmptyState
            icon={<Users className="w-6 h-6" />}
            title="No hay agentes todavía"
            description="Sumá al equipo para poder asignarle leads, tasaciones y objetivos."
            action={<Button onClick={() => setShowCreate(true)} icon={<UserPlus className="w-4 h-4" />}>Nuevo agente</Button>}
          />
        ) : (
          <div className="space-y-3">
            {agents.map(agent => (
              <Card key={agent.id} className="flex items-center gap-4">
                <Avatar name={agent.full_name || '?'} src={agent.photo_url} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Text weight="medium">{agent.full_name}</Text>
                    {agent.id === currentUser?.id && (
                      <span className="text-[10px] bg-info/10 text-info px-1.5 py-0.5 rounded-full">Tú</span>
                    )}

                    {agent.id === currentUser?.id ? (
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${getRoleColor(agent.role)}`}>
                        {getRoleLabel(agent.role)}
                      </span>
                    ) : (
                      <div className="relative" data-role-popover>
                        <Button variant="ghost" size="icon"
                          onClick={() => setChangingRole(changingRole === agent.id ? null : agent.id)}
                          disabled={!!updatingRoleId}
                          className={`text-[10px] px-2 py-0.5 rounded-full font-medium flex items-center gap-0.5 hover:opacity-80 transition-opacity ${getRoleColor(agent.role)}`}
                        >
                          {getRoleLabel(agent.role)}
                          <ChevronDown className="w-2.5 h-2.5" />
                        </Button>
                        {changingRole === agent.id && (
                          <div className="absolute top-6 left-1/2 -translate-x-1/2 z-20 bg-white border rounded-card shadow-pop py-1 min-w-[160px]">
                            {roles.map(r => (
                              <Button variant="ghost" size="icon"
                                key={r.id}
                                onClick={() => handleRoleChange(agent.id, r.id, r.name)}
                                className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2 ${
                                  agent.role === r.name ? 'font-medium text-brand-pink' : 'text-gray-700'
                                }`}
                              >
                                {agent.role === r.name
                                  ? <Check className="w-3 h-3 shrink-0" />
                                  : <span className="w-3 h-3 shrink-0" />
                                }
                                {r.label}
                              </Button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-gray-400">
                    {agent.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{agent.email}</span>}
                    {agent.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{agent.phone}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="icon"
                    onClick={() => openEdit(agent)}
                    aria-label={`Editar ${agent.full_name}`}
                    className="p-2 text-gray-400 hover:text-primary hover:bg-primary/10 rounded-control"
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                  {agent.id !== currentUser?.id && (
                    <Button variant="ghost" size="icon"
                      onClick={() => handleDelete(agent)}
                      aria-label={`Eliminar ${agent.full_name}`}
                      className="p-2 text-gray-400 hover:text-danger hover:bg-danger/10 rounded-control"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )
      ) : deleted.length === 0 ? (
        <EmptyState
          icon={<Trash className="w-6 h-6" />}
          title="La papelera está vacía"
          description="Los agentes que elimines aparecen acá y podés restaurarlos."
        />
      ) : (
        <div className="space-y-3">
          {deleted.map(agent => {
            const deletedAt = formatDeletedAt(agent.deleted_at)
            return (
              <Card key={agent.id} className="flex items-center gap-4">
                <Avatar name={agent.full_name || '?'} src={agent.photo_url} className="opacity-50 grayscale" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Text weight="medium" className="text-gray-500">{agent.full_name}</Text>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-gray-100 text-gray-600">
                      {getRoleLabel(agent.role)}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-gray-400">
                    {agent.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{agent.email}</span>}
                    {deletedAt && <span>Eliminado el {deletedAt}</span>}
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleRestore(agent)}
                  loading={restoringId === agent.id}
                  disabled={restoringId === agent.id}
                  icon={<RotateCcw className="w-4 h-4" />}
                >
                  Restaurar
                </Button>
              </Card>
            )
          })}
        </div>
      )}

      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="Nuevo agente"
        icon={<UserPlus className="w-4 h-4" />}
        footer={
          <>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancelar</Button>
            <Button onClick={handleCreate} loading={saving}
              disabled={!form.full_name || !form.email || !form.password || saving}>
              Crear agente
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Nombre completo" required>
            <Input value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} />
          </Field>
          <Field label="Email" required>
            <Input type="email" autoComplete="off" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
          </Field>
          <Field label="Contraseña" required hint="Mínimo 6 caracteres.">
            <Input type="password" autoComplete="new-password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
          </Field>
          <Field label="Teléfono">
            <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
          </Field>
          <Field label="Rol">
            <Select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
              <option value="agent">Agente</option>
              <option value="supervisor">Supervisor</option>
              <option value="admin">Administrador</option>
            </Select>
          </Field>
        </div>
      </Modal>

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={`Editar ${editing?.full_name ?? 'agente'}`}
        icon={<Pencil className="w-4 h-4" />}
        footer={
          <>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={handleEdit} loading={saving}
              disabled={!editForm.full_name || !editForm.email || saving}>
              Guardar cambios
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Nombre completo" required>
            <Input value={editForm.full_name} onChange={e => setEditForm(f => ({ ...f, full_name: e.target.value }))} />
          </Field>
          <Field label="Email" required hint="Es el usuario con el que inicia sesión.">
            <Input type="email" autoComplete="off" value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} />
          </Field>
          <Field label="Teléfono">
            <Input value={editForm.phone} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} />
          </Field>
          <Field label="Nueva contraseña" hint="Dejalo vacío para no cambiarla. Mínimo 6 caracteres.">
            <Input type="password" autoComplete="new-password" placeholder="••••••" value={editForm.password}
              onChange={e => setEditForm(f => ({ ...f, password: e.target.value }))} />
          </Field>
          <Text size="xs" tone="muted">El rol se cambia desde el pill de rol en la lista.</Text>
        </div>
      </Modal>
    </div>
  )
}
