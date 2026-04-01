'use client'
import { useState } from 'react'
import { Mail, Phone, Trash2, Shield } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { USER_ROLES, getRoleLabel, getRoleColor } from '@/lib/crm-config'

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default function AgentList({ agents: initial, currentUserId }: { agents: any[]; currentUserId: string }) {
  const { toast } = useToast()
  const [agents, setAgents] = useState(initial)
  const [changingRole, setChangingRole] = useState<string | null>(null)

  const deleteAgent = async (agent: any) => {
    if (agent.id === currentUserId) { toast('No pod\u00e9s eliminarte a vos mismo', 'error'); return }
    if (!confirm(`\u00bfEliminar a "${agent.full_name}"? Esta acci\u00f3n no se puede deshacer.`)) return
    try {
      const res = await fetch(`/api/agents?id=${agent.id}`, { method: 'DELETE' })
      const data = (await res.json()) as any
      if (data.error) { toast(data.error, 'error'); return }
      setAgents(prev => prev.filter(a => a.id !== agent.id))
      toast(`${agent.full_name} eliminado`, 'warning')
    } catch { toast('Error al eliminar', 'error') }
  }

  const changeRole = async (agentId: string, newRole: string) => {
    if (agentId === currentUserId) { toast('No pod\u00e9s cambiar tu propio rol', 'error'); return }
    setChangingRole(agentId)
    try {
      const res = await fetch('/api/agents', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: agentId, role: newRole }),
      })
      const data = (await res.json()) as any
      if (data.error) { toast(data.error, 'error'); return }
      setAgents(prev => prev.map(a => a.id === agentId ? { ...a, role: newRole } : a))
      toast(`Rol actualizado a ${getRoleLabel(newRole)}`, 'success')
    } catch { toast('Error', 'error') }
    finally { setChangingRole(null) }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm divide-y divide-gray-100">
      {agents.map((agent: any) => (
        <div key={agent.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-10 h-10 rounded-full bg-brand-pink/20 flex items-center justify-center text-brand-pink font-semibold flex-shrink-0">
              {(agent.full_name as string).charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="font-medium text-gray-800 flex items-center gap-2 flex-wrap">
                <span className="truncate">{agent.full_name}</span>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${getRoleColor(agent.role)}`}>
                  {getRoleLabel(agent.role)}
                </span>
                {agent.id === currentUserId && (
                  <span className="text-[10px] text-gray-400">(vos)</span>
                )}
              </p>
              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 text-sm text-brand-gray mt-0.5">
                <span className="flex items-center gap-1 truncate"><Mail className="w-3 h-3 flex-shrink-0" /> {agent.email}</span>
                {agent.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3 flex-shrink-0" /> {agent.phone}</span>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 ml-13 sm:ml-0">
            {/* Role selector */}
            {agent.id !== currentUserId && (
              <select
                value={agent.role}
                onChange={e => changeRole(agent.id, e.target.value)}
                disabled={changingRole === agent.id}
                className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-600 hover:border-gray-300 focus:ring-1 focus:ring-[#ff007c]/20"
              >
                <option value="agent">Agente</option>
                <option value="supervisor">Supervisor</option>
                <option value="admin">Admin</option>
              </select>
            )}
            <span className="text-xs text-brand-gray flex-shrink-0 hidden sm:inline">Desde {formatDate(agent.created_at)}</span>
            {/* Delete */}
            {agent.id !== currentUserId && (
              <button onClick={() => deleteAgent(agent)}
                className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                title="Eliminar agente">
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
