import { getAgents } from '@/lib/actions'
import { getCurrentUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import AgentList from './AgentList'

export default async function AgentesPage() {
  const user = await getCurrentUser()
  if (!user || (user.role !== 'admin' && user.role !== 'owner')) redirect('/dashboard')

  const agents = await getAgents()

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 sm:mb-8">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-800">Equipo</h1>
          <p className="text-brand-gray text-sm mt-1">{agents.length} agente{agents.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/admin/objetivos" className="inline-flex items-center justify-center gap-2 border border-gray-300 text-gray-700 px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50">
            Objetivos
          </Link>
          <Link href="/admin/importar" className="inline-flex items-center justify-center gap-2 border border-gray-300 text-gray-700 px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50">
            Importar
          </Link>
          <Link href="/admin/agentes/nuevo" className="inline-flex items-center justify-center gap-2 bg-brand-pink text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:opacity-90">
            <Plus className="w-4 h-4" /> Nuevo agente
          </Link>
        </div>
      </div>

      <AgentList agents={JSON.parse(JSON.stringify(agents))} currentUserId={user.id} />
    </div>
  )
}
