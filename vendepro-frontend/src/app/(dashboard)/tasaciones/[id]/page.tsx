'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, ExternalLink, Ruler, Eye, TrendingUp, Shield, Pencil, Loader2 } from 'lucide-react'
import { apiFetch } from '@/lib/api'

export default function TasacionDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [appraisal, setAppraisal] = useState<any>(null)
  const [comparables, setComparables] = useState<any[]>([])
  const [linkedLead, setLinkedLead] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const res = await apiFetch('properties', `/appraisals?id=${id}`)
        const data = (await res.json()) as any
        if (data.error || !data.id) { router.push('/tasaciones'); return }
        setAppraisal(data)
        setComparables(data.comparables || [])
        if (data.lead_id) {
          try {
            const lr = await apiFetch('crm', `/leads?id=${data.lead_id}`)
            const ld = (await lr.json()) as any
            if (ld.id) setLinkedLead(ld)
          } catch {}
        }
      } catch { router.push('/tasaciones') }
      setLoading(false)
    }
    load()
  }, [id, router])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-[#ff007c]" />
      </div>
    )
  }

  if (!appraisal) return null

  const a = appraisal
  const weighted = Number(a.weighted_area) || 0
  const usdM2 = Number(a.usd_per_m2) || 0

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/tasaciones" className="p-2 rounded-lg hover:bg-gray-100">
          <ArrowLeft className="w-5 h-5 text-gray-500" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-800 truncate">{a.property_address}</h1>
          <p className="text-gray-500 text-sm">{a.neighborhood}, {a.city}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/tasaciones/${id}/editar`}
            className="inline-flex items-center gap-2 border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50"
          >
            <Pencil className="w-4 h-4" /> Editar
          </Link>
          {a.public_slug && (
            <a
              href={`/t/${a.public_slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-[#ff007c] text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90"
            >
              <ExternalLink className="w-4 h-4" /> Ver landing
            </a>
          )}
        </div>
      </div>

      {/* Lead/Contact origin */}
      {(linkedLead || a.contact_name) && (
        <div className="flex flex-wrap items-center gap-3 mb-4">
          {linkedLead && (
            <Link href={`/leads/${linkedLead.id}`} className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-xl hover:bg-blue-100 transition-colors">
              <span className="text-xs font-medium text-blue-700">Lead origen:</span>
              <span className="text-sm text-blue-800 font-semibold">{linkedLead.full_name}</span>
              {linkedLead.phone && <span className="text-xs text-blue-500">{linkedLead.phone}</span>}
            </Link>
          )}
          {!linkedLead && a.contact_name && (
            <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl">
              <span className="text-xs font-medium text-gray-500">Contacto:</span>
              <span className="text-sm text-gray-800">{a.contact_name}</span>
              {a.contact_phone && <span className="text-xs text-gray-500">{a.contact_phone}</span>}
            </div>
          )}
        </div>
      )}

      {/* Preview pages */}
      <div className="space-y-4 max-w-3xl mx-auto">

        {/* PAGE 1: Cover */}
        <div className="bg-gradient-to-br from-[#ff007c] via-[#ff3d94] to-[#ff8017] rounded-2xl p-6 sm:p-10 text-white shadow-lg aspect-[794/1123] flex flex-col justify-between relative overflow-hidden">
          <div>
            <img src="/logo.png" alt="Logo" className="h-8 sm:h-12 brightness-0 invert mb-4" />
            <p className="text-white/70 text-xs sm:text-sm font-medium tracking-wider uppercase">Propuesta de tasación</p>
          </div>
          <div>
            <h2 className="text-2xl sm:text-4xl font-bold leading-tight mb-2">{a.property_address}</h2>
            <p className="text-white/80 text-sm sm:text-lg">{a.neighborhood}, {a.city}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white font-bold">
              {(a.agent_name || 'A').charAt(0)}
            </div>
            <div>
              <p className="font-semibold text-sm">{a.agent_name}</p>
              <p className="text-white/70 text-xs">{a.agent_phone} · {a.agent_email}</p>
            </div>
          </div>
        </div>

        {/* PAGE 2: Property Data + FODA */}
        <div className="bg-white rounded-2xl shadow-sm p-5 sm:p-8">
          <h2 className="text-lg sm:text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Ruler className="w-5 h-5 text-[#ff007c]" />
            Datos de la propiedad
          </h2>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <div className="bg-gray-50 rounded-xl p-3 text-center">
              <p className="text-[10px] sm:text-xs text-gray-500">Tipología</p>
              <p className="font-bold text-sm text-gray-800 capitalize">{a.property_type}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 text-center">
              <p className="text-[10px] sm:text-xs text-gray-500">Sup. cubierta</p>
              <p className="font-bold text-sm text-gray-800">{a.covered_area || '-'} m²</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 text-center">
              <p className="text-[10px] sm:text-xs text-gray-500">Sup. total</p>
              <p className="font-bold text-sm text-gray-800">{a.total_area || '-'} m²</p>
            </div>
            <div className="bg-[#ff007c]/5 border border-[#ff007c]/20 rounded-xl p-3 text-center">
              <p className="text-[10px] sm:text-xs text-gray-500">Ponderada</p>
              <p className="font-bold text-sm text-[#ff007c]">{weighted.toFixed(1)} m²</p>
            </div>
          </div>

          {/* FODA */}
          {(a.strengths || a.weaknesses || a.opportunities || a.threats) && (
            <div>
              <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                <Shield className="w-4 h-4 text-indigo-500" />
                Análisis FODA
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {a.strengths && (
                  <div className="bg-green-50 border border-green-200 rounded-xl p-3">
                    <p className="text-xs font-semibold text-green-700 mb-1">Fortalezas</p>
                    <p className="text-xs text-green-800 whitespace-pre-wrap">{a.strengths}</p>
                  </div>
                )}
                {a.weaknesses && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                    <p className="text-xs font-semibold text-red-700 mb-1">Debilidades</p>
                    <p className="text-xs text-red-800 whitespace-pre-wrap">{a.weaknesses}</p>
                  </div>
                )}
                {a.opportunities && (
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                    <p className="text-xs font-semibold text-blue-700 mb-1">Oportunidades</p>
                    <p className="text-xs text-blue-800 whitespace-pre-wrap">{a.opportunities}</p>
                  </div>
                )}
                {a.threats && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3">
                    <p className="text-xs font-semibold text-yellow-700 mb-1">Amenazas</p>
                    <p className="text-xs text-yellow-800 whitespace-pre-wrap">{a.threats}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {a.publication_analysis && (
            <div className="mt-4 bg-orange-50 border border-orange-200 rounded-xl p-4">
              <p className="text-xs font-semibold text-orange-700 mb-1">Análisis de publicación actual</p>
              <p className="text-xs text-orange-800 whitespace-pre-wrap">{a.publication_analysis}</p>
            </div>
          )}
        </div>

        {/* PAGE 3: Comparables */}
        {comparables.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm p-5 sm:p-8">
            <h2 className="text-lg sm:text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Eye className="w-5 h-5 text-indigo-500" />
              Departamentos publicados en la zona
            </h2>

            <div className="overflow-x-auto -mx-2">
              <table className="w-full text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left p-2 font-medium text-gray-500">Dirección</th>
                    <th className="text-center p-2 font-medium text-gray-500">m²</th>
                    <th className="text-center p-2 font-medium text-gray-500">Precio</th>
                    <th className="text-center p-2 font-medium text-gray-500">USD/m²</th>
                    <th className="text-center p-2 font-medium text-gray-500">Días</th>
                    <th className="text-center p-2 font-medium text-gray-500">Vistas/d</th>
                  </tr>
                </thead>
                <tbody>
                  {comparables.map((c: any, i: number) => (
                    <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="p-2">
                        <div className="min-w-0">
                          <p className="font-medium text-gray-800 truncate max-w-[150px] sm:max-w-none">{c.address || 'Sin dirección'}</p>
                          {c.zonaprop_url && (
                            <a href={c.zonaprop_url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-indigo-500 hover:underline">
                              Ver aviso →
                            </a>
                          )}
                        </div>
                      </td>
                      <td className="text-center p-2">{c.total_area || '-'}</td>
                      <td className="text-center p-2 font-semibold text-[#ff007c]">
                        {c.price ? `$${Number(c.price).toLocaleString('es-AR')}` : '-'}
                      </td>
                      <td className="text-center p-2">{c.usd_per_m2 ? Number(c.usd_per_m2).toLocaleString('es-AR') : '-'}</td>
                      <td className="text-center p-2">{c.days_on_market || '-'}</td>
                      <td className="text-center p-2">{c.views_per_day || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* PAGE 4: Valuation */}
        <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-5 sm:p-8 text-white shadow-lg">
          <h2 className="text-lg sm:text-xl font-bold mb-6 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-[#ff007c]" />
            Tasación proyectada
          </h2>

          <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-6">
            <div className="bg-white/10 rounded-xl p-4 text-center">
              <p className="text-xs text-white/60">Sup. ponderada</p>
              <p className="text-xl sm:text-2xl font-bold">{weighted.toFixed(1)} m²</p>
            </div>
            <div className="bg-white/10 rounded-xl p-4 text-center">
              <p className="text-xs text-white/60">USD/m² promedio</p>
              <p className="text-xl sm:text-2xl font-bold">{usdM2.toLocaleString('es-AR')}</p>
            </div>
          </div>

          <div className="space-y-3">
            {a.test_price && (
              <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-white/60">Valor de publicación prueba</p>
                  <p className="text-xs text-white/40">Primeros 30 días</p>
                </div>
                <p className="text-xl sm:text-2xl font-bold text-yellow-400">
                  USD {Number(a.test_price).toLocaleString('es-AR')}
                </p>
              </div>
            )}

            {a.suggested_price && (
              <div className="bg-[#ff007c]/20 border border-[#ff007c]/30 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-white/80 font-semibold">Valor sugerido</p>
                  <p className="text-xs text-white/40">Valor de mercado</p>
                </div>
                <p className="text-2xl sm:text-3xl font-bold text-[#ff007c]">
                  USD {Number(a.suggested_price).toLocaleString('es-AR')}
                </p>
              </div>
            )}

            {a.expected_close_price && (
              <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-white/60">Precio de cierre esperado</p>
                  <p className="text-xs text-white/40">120 días</p>
                </div>
                <p className="text-xl sm:text-2xl font-bold text-green-400">
                  USD {Number(a.expected_close_price).toLocaleString('es-AR')}
                </p>
              </div>
            )}

            {usdM2 > 0 && (
              <div className="text-center pt-2">
                <p className="text-xs text-white/40">
                  {usdM2.toLocaleString('es-AR')} USD/m² × {weighted.toFixed(1)} m² = USD {Math.round(usdM2 * weighted).toLocaleString('es-AR')}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="bg-white rounded-2xl shadow-sm p-5 sm:p-8 text-center">
          <img src="/logo.png" alt="Logo" className="h-8 sm:h-10 mx-auto mb-3" />
          <p className="text-sm font-semibold text-gray-800">Marcela Genta · Operaciones Inmobiliarias</p>
          <p className="text-xs text-gray-500 mt-1">{a.agent_name} · {a.agent_phone}</p>
          <p className="text-xs text-gray-400 mt-1">{a.agent_email}</p>
          <p className="text-[10px] text-gray-300 mt-3">
            Todas las operaciones inmobiliarias son objeto de intermediación y conclusión por parte de Marcela Genta,
            Colegio Profesional Inmobiliario Matrícula N°3906
          </p>
        </div>
      </div>
    </div>
  )
}
