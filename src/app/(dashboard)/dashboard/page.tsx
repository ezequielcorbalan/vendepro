import { getAgencyDashboard } from '@/lib/analytics'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  Building2, FileBarChart, Plus, TrendingUp, Eye, Users,
  MapPin, BarChart3, Target, Phone, MessageCircle, Award
} from 'lucide-react'
import DashboardCharts from '@/components/dashboard/DashboardCharts'

export default async function DashboardPage() {
  const data = await getAgencyDashboard()
  if (!data) redirect('/login')

  const { user, isAdmin, overview, agentStats, neighborhoods, soldComparison } = data

  const soldData = soldComparison.find((s: any) => s.status === 'sold')
  const activeData = soldComparison.find((s: any) => s.status === 'active')

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-gray-800">
            {isAdmin ? 'Dashboard de Sucursal' : 'Mi Dashboard'}
          </h1>
          <p className="text-brand-gray text-sm mt-1">
            {isAdmin ? 'Métricas generales de la inmobiliaria' : `Hola, ${user.full_name}`}
          </p>
        </div>
        <Link
          href="/propiedades/nueva"
          className="inline-flex items-center gap-2 bg-brand-pink text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <Plus className="w-4 h-4" />
          Nueva propiedad
        </Link>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-brand-pink/10 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-brand-pink" />
            </div>
          </div>
          <p className="text-3xl font-bold text-gray-800">{overview.active_properties}</p>
          <p className="text-xs text-brand-gray mt-1">Propiedades activas</p>
        </div>

        <div className="bg-white rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-green-600" />
            </div>
          </div>
          <p className="text-3xl font-bold text-gray-800">{overview.sold_properties}</p>
          <p className="text-xs text-brand-gray mt-1">Vendidas</p>
        </div>

        <div className="bg-white rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-brand-orange/10 flex items-center justify-center">
              <FileBarChart className="w-5 h-5 text-brand-orange" />
            </div>
          </div>
          <p className="text-3xl font-bold text-gray-800">{overview.total_reports}</p>
          <p className="text-xs text-brand-gray mt-1">Reportes publicados</p>
        </div>

        {isAdmin && (
          <div className="bg-white rounded-xl p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center">
                <Users className="w-5 h-5 text-indigo-600" />
              </div>
            </div>
            <p className="text-3xl font-bold text-gray-800">{overview.total_agents}</p>
            <p className="text-xs text-brand-gray mt-1">Agentes</p>
          </div>
        )}

        {!isAdmin && (
          <div className="bg-white rounded-xl p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
                <Target className="w-5 h-5 text-red-500" />
              </div>
            </div>
            <p className="text-3xl font-bold text-gray-800">{overview.conversion_rate.toFixed(1)}%</p>
            <p className="text-xs text-brand-gray mt-1">Tasa de conversión</p>
          </div>
        )}
      </div>

      {/* Metrics Summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl p-4 text-white">
          <Eye className="w-5 h-5 mb-2 opacity-80" />
          <p className="text-2xl font-bold">{overview.total_impressions.toLocaleString('es-AR')}</p>
          <p className="text-xs opacity-80 mt-1">Impresiones totales</p>
        </div>
        <div className="bg-gradient-to-br from-[#ff007c] to-[#ff3d94] rounded-xl p-4 text-white">
          <BarChart3 className="w-5 h-5 mb-2 opacity-80" />
          <p className="text-2xl font-bold">{overview.total_visits.toLocaleString('es-AR')}</p>
          <p className="text-xs opacity-80 mt-1">Visitas a avisos</p>
        </div>
        <div className="bg-gradient-to-br from-[#ff8017] to-orange-500 rounded-xl p-4 text-white">
          <MessageCircle className="w-5 h-5 mb-2 opacity-80" />
          <p className="text-2xl font-bold">{overview.total_inquiries.toLocaleString('es-AR')}</p>
          <p className="text-xs opacity-80 mt-1">Consultas totales</p>
        </div>
        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-4 text-white">
          <Users className="w-5 h-5 mb-2 opacity-80" />
          <p className="text-2xl font-bold">{overview.total_in_person_visits.toLocaleString('es-AR')}</p>
          <p className="text-xs opacity-80 mt-1">Visitas presenciales</p>
        </div>
        <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl p-4 text-white">
          <Award className="w-5 h-5 mb-2 opacity-80" />
          <p className="text-2xl font-bold">{overview.total_offers.toLocaleString('es-AR')}</p>
          <p className="text-xs opacity-80 mt-1">Ofertas recibidas</p>
        </div>
      </div>

      {/* Sold vs Active Comparison */}
      {(soldData || activeData) && (
        <div className="bg-white rounded-xl shadow-sm p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <span className="w-1 h-6 bg-brand-pink rounded-full"></span>
            Vendidas vs Activas — Métricas promedio
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Sold */}
            <div className="border border-green-200 bg-green-50/50 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <span className="w-3 h-3 bg-green-500 rounded-full"></span>
                <h3 className="font-semibold text-gray-800">Vendidas ({soldData?.count || 0})</h3>
              </div>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-xl font-bold text-gray-800">{Math.round(soldData?.avg_impressions || 0).toLocaleString('es-AR')}</p>
                  <p className="text-xs text-gray-500">Impresiones prom.</p>
                </div>
                <div>
                  <p className="text-xl font-bold text-gray-800">{Math.round(soldData?.avg_visits || 0).toLocaleString('es-AR')}</p>
                  <p className="text-xs text-gray-500">Visitas prom.</p>
                </div>
                <div>
                  <p className="text-xl font-bold text-gray-800">{Math.round(soldData?.avg_inquiries || 0).toLocaleString('es-AR')}</p>
                  <p className="text-xs text-gray-500">Consultas prom.</p>
                </div>
              </div>
            </div>

            {/* Active */}
            <div className="border border-blue-200 bg-blue-50/50 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <span className="w-3 h-3 bg-blue-500 rounded-full"></span>
                <h3 className="font-semibold text-gray-800">Activas ({activeData?.count || 0})</h3>
              </div>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-xl font-bold text-gray-800">{Math.round(activeData?.avg_impressions || 0).toLocaleString('es-AR')}</p>
                  <p className="text-xs text-gray-500">Impresiones prom.</p>
                </div>
                <div>
                  <p className="text-xl font-bold text-gray-800">{Math.round(activeData?.avg_visits || 0).toLocaleString('es-AR')}</p>
                  <p className="text-xs text-gray-500">Visitas prom.</p>
                </div>
                <div>
                  <p className="text-xl font-bold text-gray-800">{Math.round(activeData?.avg_inquiries || 0).toLocaleString('es-AR')}</p>
                  <p className="text-xs text-gray-500">Consultas prom.</p>
                </div>
              </div>
            </div>
          </div>

          {soldData && activeData && soldData.avg_impressions > 0 && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">
                <span className="font-medium">💡 Insight:</span>{' '}
                Las propiedades vendidas tuvieron en promedio{' '}
                <span className="font-semibold text-green-600">
                  {Math.round(soldData.avg_impressions).toLocaleString('es-AR')} impresiones
                </span>{' '}
                y{' '}
                <span className="font-semibold text-green-600">
                  {Math.round(soldData.avg_inquiries).toLocaleString('es-AR')} consultas
                </span>.
                {activeData.avg_impressions > 0 && (
                  <span>
                    {' '}Las activas llevan{' '}
                    <span className="font-semibold text-blue-600">
                      {Math.round(activeData.avg_impressions).toLocaleString('es-AR')} impresiones
                    </span>{' '}
                    y{' '}
                    <span className="font-semibold text-blue-600">
                      {Math.round(activeData.avg_inquiries).toLocaleString('es-AR')} consultas
                    </span> promedio.
                  </span>
                )}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Agent Rankings (admin only) */}
      {isAdmin && agentStats.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm mb-8">
          <div className="p-6 border-b border-gray-100">
            <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <span className="w-1 h-6 bg-indigo-500 rounded-full"></span>
              Rendimiento por agente
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left p-4 font-medium text-gray-500">Agente</th>
                  <th className="text-center p-4 font-medium text-gray-500">Propiedades</th>
                  <th className="text-center p-4 font-medium text-gray-500">Activas</th>
                  <th className="text-center p-4 font-medium text-gray-500">Vendidas</th>
                  <th className="text-center p-4 font-medium text-gray-500">Reportes</th>
                  <th className="text-center p-4 font-medium text-gray-500">Impresiones</th>
                  <th className="text-center p-4 font-medium text-gray-500">Consultas</th>
                  <th className="text-center p-4 font-medium text-gray-500">Visitas</th>
                </tr>
              </thead>
              <tbody>
                {agentStats.map((agent) => (
                  <tr key={agent.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-brand-pink/20 flex items-center justify-center text-brand-pink font-semibold text-xs">
                          {agent.full_name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-medium text-gray-800">{agent.full_name}</p>
                          <p className="text-xs text-gray-400">{agent.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="text-center p-4 font-medium">{agent.total_properties}</td>
                    <td className="text-center p-4">
                      <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-xs font-medium">{agent.active_properties}</span>
                    </td>
                    <td className="text-center p-4">
                      <span className="bg-pink-100 text-pink-700 px-2 py-0.5 rounded-full text-xs font-medium">{agent.sold_properties}</span>
                    </td>
                    <td className="text-center p-4">{agent.total_reports}</td>
                    <td className="text-center p-4 text-gray-600">{Number(agent.total_impressions).toLocaleString('es-AR')}</td>
                    <td className="text-center p-4 text-gray-600">{Number(agent.total_inquiries).toLocaleString('es-AR')}</td>
                    <td className="text-center p-4 text-gray-600">{Number(agent.total_in_person_visits).toLocaleString('es-AR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Neighborhood Analytics */}
      {neighborhoods.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm mb-8">
          <div className="p-6 border-b border-gray-100">
            <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <span className="w-1 h-6 bg-[#ff8017] rounded-full"></span>
              Métricas por barrio
            </h2>
            <p className="text-xs text-gray-400 mt-1">Promedios de métricas por reporte en cada barrio</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left p-4 font-medium text-gray-500">Barrio</th>
                  <th className="text-center p-4 font-medium text-gray-500">Propiedades</th>
                  <th className="text-center p-4 font-medium text-gray-500">Vendidas</th>
                  <th className="text-center p-4 font-medium text-gray-500">Impresiones prom.</th>
                  <th className="text-center p-4 font-medium text-gray-500">Visitas prom.</th>
                  <th className="text-center p-4 font-medium text-gray-500">Consultas prom.</th>
                  <th className="text-center p-4 font-medium text-gray-500">Precio prom.</th>
                </tr>
              </thead>
              <tbody>
                {neighborhoods.map((n) => (
                  <tr key={n.neighborhood} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-brand-orange" />
                        <span className="font-medium text-gray-800">{n.neighborhood}</span>
                      </div>
                    </td>
                    <td className="text-center p-4 font-medium">{n.total_properties}</td>
                    <td className="text-center p-4">
                      <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-xs font-medium">
                        {n.sold_count}
                      </span>
                    </td>
                    <td className="text-center p-4 text-gray-600">{n.avg_impressions.toLocaleString('es-AR')}</td>
                    <td className="text-center p-4 text-gray-600">{n.avg_visits.toLocaleString('es-AR')}</td>
                    <td className="text-center p-4 text-gray-600">{n.avg_inquiries.toLocaleString('es-AR')}</td>
                    <td className="text-center p-4 text-gray-600">
                      {n.avg_price > 0 ? `USD ${Math.round(n.avg_price).toLocaleString('es-AR')}` : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Charts */}
      <DashboardCharts
        neighborhoods={neighborhoods as any[]}
        agentStats={agentStats as any[]}
        soldComparison={soldComparison as any[]}
        isAdmin={isAdmin}
      />
    </div>
  )
}
