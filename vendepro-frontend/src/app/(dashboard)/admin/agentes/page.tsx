'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Users, Plus, Trash2, Loader2, Mail, Phone, Check, ChevronDown } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { getCurrentUser } from '@/lib/auth'
import { getRoleLabel, getRoleColor } from '@/lib/crm-config'

interface Role {
  id: number
  name: string
  label: string
}

export default function AgentesPage() {
  const { toast } = useToast()
  const [agents, setAgents] = useState<any[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [saving, setSaving] = useState(false)
  const [changingRole, setChangingRole] = useState<string | null>(null)
  const [updatingRoleId, setUpdatingRoleId] = useState<string | null>(null)
  const [form, setForm] = useState({ full_name: '', email: '', password: '', role: 'agent', phone: '' })
  const currentUser = getCurrentUser()

  function loadAgents() {
    apiFetch('admin', '/agents')
      .then(r => r.json() as Promise<any>)
      .then(d => { setAgents(Array.isArray(d) ? d : (d.agents || [])); setLoading(false) })
      .catch(() => setLoading(false))
  }

  function loadRoles() {
    apiFetch('admin', '/roles')
      .then(r => r.json() as Promise<any>)
      .then(d => { if (Array.isArray(d)) setRoles(d) })
      .catch(() => {})
  }

  useEffect(() => {
    loadAgents()
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
        setForm({ full_name: '', email: '', password: '', role: 'agent', phone: '' })
        loadAgents()
      } else {
        toast(data.error || 'Error al crear agente', 'error')
      }
    } catch { toast('Error de conexión', 'error') }
    setSaving(false)
  }

  async function handleDelete(id: string, name: string) {
    if (id === currentUser?.id) { toast('No podés eliminarte a vos mismo', 'warning'); return }
    if (!confirm(`¿Eliminar a "${name}"?`)) return
    try {
      await apiFetch('admin', `/agents?id=${id}`, { method: 'DELETE' })
      toast('Agente eliminado', 'warning')
      loadAgents()
    } catch { toast('Error al eliminar', 'error') }
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-800">Equipo</h1>
          <p className="text-gray-500 text-sm mt-1">{agents.length} agente{agents.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/admin/objetivos" className="border border-gray-300 text-gray-700 px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50">
            Objetivos
          </Link>
          <button onClick={() => setShowCreate(true)} className="bg-[#ff007c] text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:opacity-90 flex items-center gap-2">
            <Plus className="w-4 h-4" /> Nuevo agente
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
      ) : agents.length === 0 ? (
        <div className="bg-white rounded-xl border p-8 text-center">
          <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No hay agentes todavía</p>
        </div>
      ) : (
        <div className="space-y-3">
          {agents.map(agent => (
            <div key={agent.id} className="bg-white border rounded-xl p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-[#ff007c]/20 flex items-center justify-center text-[#ff007c] font-semibold shrink-0">
                {agent.full_name?.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium text-gray-800">{agent.full_name}</p>
                  {agent.id === currentUser?.id && (
                    <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">Tú</span>
                  )}

                  {agent.id === currentUser?.id ? (
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${getRoleColor(agent.role)}`}>
                      {getRoleLabel(agent.role)}
                    </span>
                  ) : (
                    <div className="relative" data-role-popover>
                      <button
                        onClick={() => setChangingRole(changingRole === agent.id ? null : agent.id)}
                        disabled={!!updatingRoleId}
                        className={`text-[10px] px-2 py-0.5 rounded-full font-medium flex items-center gap-0.5 hover:opacity-80 transition-opacity ${getRoleColor(agent.role)}`}
                      >
                        {getRoleLabel(agent.role)}
                        <ChevronDown className="w-2.5 h-2.5" />
                      </button>
                      {changingRole === agent.id && (
                        <div className="absolute top-6 left-0 z-20 bg-white border rounded-xl shadow-lg py-1 min-w-[160px]">
                          {roles.map(r => (
                            <button
                              key={r.id}
                              onClick={() => handleRoleChange(agent.id, r.id, r.name)}
                              className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2 ${
                                agent.role === r.name ? 'font-medium text-[#ff007c]' : 'text-gray-700'
                              }`}
                            >
                              {agent.role === r.name
                                ? <Check className="w-3 h-3 shrink-0" />
                                : <span className="w-3 h-3 shrink-0" />
                              }
                              {r.label}
                            </button>
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
              {agent.id !== currentUser?.id && (
                <button onClick={() => handleDelete(agent.id, agent.full_name)} className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setShowCreate(false)}>
          <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl p-5" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-gray-800 mb-4">Nuevo agente</h3>
            <div className="space-y-3">
              <input placeholder="Nombre completo *" value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                className="border rounded-lg px-3 py-2 text-sm w-full" />
              <input placeholder="Email *" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                className="border rounded-lg px-3 py-2 text-sm w-full" />
              <input placeholder="Contraseña *" type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                className="border rounded-lg px-3 py-2 text-sm w-full" />
              <input placeholder="Teléfono" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                className="border rounded-lg px-3 py-2 text-sm w-full" />
              <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} className="border rounded-lg px-3 py-2 text-sm w-full">
                <option value="agent">Agente</option>
                <option value="supervisor">Supervisor</option>
                <option value="admin">Administrador</option>
              </select>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setShowCreate(false)} className="flex-1 border rounded-lg py-2 text-sm">Cancelar</button>
              <button onClick={handleCreate} disabled={!form.full_name || !form.email || !form.password || saving}
                className="flex-1 bg-[#ff007c] text-white rounded-lg py-2 text-sm font-medium disabled:opacity-50">
                {saving ? 'Creando...' : 'Crear agente'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
