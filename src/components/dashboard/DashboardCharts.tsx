'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'

const COLORS = ['#ff007c', '#ff8017', '#6366f1', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444']

interface Props {
  neighborhoods: any[]
  agentStats: any[]
  soldComparison: any[]
  isAdmin: boolean
}

export default function DashboardCharts({ neighborhoods, agentStats, soldComparison, isAdmin }: Props) {
  const neighborhoodData = neighborhoods.slice(0, 8).map((n) => ({
    name: n.neighborhood.length > 12 ? n.neighborhood.slice(0, 12) + '…' : n.neighborhood,
    Impresiones: n.avg_impressions,
    Visitas: n.avg_visits,
    Consultas: n.avg_inquiries,
  }))

  const statusLabels: Record<string, string> = {
    sold: 'Vendidas',
    active: 'Activas',
    inactive: 'Dadas de baja',
    suspended: 'Pausadas',
    archived: 'Archivadas',
  }
  const statusColors: Record<string, string> = {
    sold: '#10b981',
    active: '#6366f1',
    inactive: '#ef4444',
    suspended: '#f59e0b',
    archived: '#9ca3af',
  }

  const pieData = soldComparison.map((s: any) => ({
    name: statusLabels[s.status] || s.status,
    value: s.count,
    color: statusColors[s.status] || '#9ca3af',
  }))

  const agentChartData = isAdmin
    ? agentStats.slice(0, 6).map((a: any) => ({
        name: a.full_name.split(' ')[0],
        Propiedades: Number(a.total_properties),
        Consultas: Number(a.total_inquiries),
        Vendidas: Number(a.sold_properties),
      }))
    : []

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
      {/* Neighborhood Metrics */}
      {neighborhoodData.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-sm font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <span className="w-1 h-5 bg-indigo-500 rounded-full"></span>
            Métricas promedio por barrio
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={neighborhoodData} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="Impresiones" fill="#6366f1" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Visitas" fill="#ff007c" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Consultas" fill="#ff8017" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Property Status Pie */}
      {pieData.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-sm font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <span className="w-1 h-5 bg-brand-pink rounded-full"></span>
            Distribución de propiedades
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={90}
                  paddingAngle={3}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {pieData.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Agent Comparison (admin only) */}
      {isAdmin && agentChartData.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-6 md:col-span-2">
          <h3 className="text-sm font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <span className="w-1 h-5 bg-green-500 rounded-full"></span>
            Comparativa de agentes
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={agentChartData} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="Propiedades" fill="#6366f1" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Consultas" fill="#ff8017" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Vendidas" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  )
}
