import { getAgents } from '@/lib/actions'
import { getCurrentUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plus, Mail, Phone } from 'lucide-react'
import { formatDate } from '@/lib/utils'

export default async function AgentesPage() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'admin') redirect('/dashboard')

  const agents = await getAgents()

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-gray-800">Agentes</h1>
          <p className="text-brand-gray text-sm mt-1">{agents.length} agente{agents.length !== 1 ? 's' : ''}</p>
        </div>
        <Link href="/admin/agentes/nuevo" className="inline-flex items-center gap-2 bg-brand-pink text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:opacity-90">
          <Plus className="w-4 h-4" /> Nuevo agente
        </Link>
      </div>

      <div className="bg-white rounded-xl shadow-sm divide-y divide-gray-100">
        {agents.map((agent: any) => (
          <div key={agent.id} className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-brand-pink/20 flex items-center justify-center text-brand-pink font-semibold">
                {(agent.full_name as string).charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="font-medium text-gray-800">
                  {agent.full_name}
                  <span className={`ml-2 text-xs font-medium px-2 py-0.5 rounded-full ${agent.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                    {agent.role === 'admin' ? 'Admin' : 'Agente'}
                  </span>
                </p>
                <div className="flex items-center gap-4 text-sm text-brand-gray mt-0.5">
                  <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {agent.email}</span>
                  {agent.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {agent.phone}</span>}
                </div>
              </div>
            </div>
            <span className="text-xs text-brand-gray">Desde {formatDate(agent.created_at)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
