import { getCurrentUser } from '@/lib/auth'
import { getDB } from '@/lib/db'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, ExternalLink, Ruler, Eye, TrendingUp, Shield, Pencil } from 'lucide-react'

export default async function TasacionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const db = await getDB()

  let appraisal: any = null
  let comparables: any[] = []
  let linkedLead: any = null

  try {
    appraisal = await db.prepare(
      'SELECT a.*, u.full_name as agent_name, u.phone as agent_phone, u.email as agent_email FROM appraisals a LEFT JOIN users u ON a.agent_id = u.id WHERE a.id = ?'
    ).bind(id).first()

    if (appraisal) {
      comparables = (await db.prepare(
        'SELECT * FROM appraisal_comparables WHERE appraisal_id = ? ORDER BY sort_order'
      ).bind(id).all()).results as any[]

      // Get linked lead if exists
      if (appraisal.lead_id) {
        try {
          linkedLead = await db.prepare('SELECT id, full_name, phone, stage FROM leads WHERE id = ?').bind(appraisal.lead_id).first()
        } catch {}
      }
    }
  } catch {
    // Tables might not exist
  }

  if (!appraisal) notFound()

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
          <p className="text-brand-gray text-sm">{a.neighborhood}, {a.city}</p>
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
              className="inline-flex items-center gap-2 bg-brand-pink text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90"
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

      {/* Preview - Canva-style */}
      <div className="space-y-4 max-w-3xl mx-auto">

        {/* PAGE 1: Cover */}
        <div className="bg-gradient-to-br from-[#ff007c] via-[#ff3d94] to-[#ff8017] rounded-2xl p-6 sm:p-10 text-white shadow-lg aspect-[794/1123] flex flex-col justify-between relative overflow-hidden">
          <div>
            <img src="/logo.png" alt="Logo" className="h-8 sm:h-12 brightness-0 invert mb-4" />
            <p className="text-white/70 text-xs sm:text-sm font-medium tracking-wider uppercase">Propuesta de tasaci&oacute;n</p>
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
              <p className="text-white/70 text-xs">{a.agent_phone} &middot; {a.agent_email}</p>
            </div>
          </div>
        </div>

        {/* PAGE 2: Property Data + FODA */}
        <div className="bg-white rounded-2xl shadow-sm p-5 sm:p-8 aspect-auto">
          <h2 className="text-lg sm:text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Ruler className="w-5 h-5 text-brand-pink" />
            Datos de la propiedad
          </h2>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <div className="bg-gray-50 rounded-xl p-3 text-center">
              <p className="text-[10px] sm:text-xs text-gray-500">Tipolog&iacute;a</p>
              <p className="font-bold text-sm text-gray-800 capitalize">{a.property_type}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 text-center">
              <p className="text-[10px] sm:text-xs text-gray-500">Sup. cubierta</p>
              <p className="font-bold text-sm text-gray-800">{a.covered_area || '-'} m&sup2;</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 text-center">
              <p className="text-[10px] sm:text-xs text-gray-500">Sup. total</p>
              <p className="font-bold text-sm text-gray-800">{a.total_area || '-'} m&sup2;</p>
            </div>
            <div className="bg-brand-pink/5 border border-brand-pink/20 rounded-xl p-3 text-center">
              <p className="text-[10px] sm:text-xs text-gray-500">Ponderada</p>
              <p className="font-bold text-sm text-brand-pink">{weighted.toFixed(1)} m&sup2;</p>
            </div>
          </div>

          {/* FODA */}
          {(a.strengths || a.weaknesses || a.opportunities || a.threats) && (
            <div>
              <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                <Shield className="w-4 h-4 text-indigo-500" />
                An&aacute;lisis FODA
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
              <p className="text-xs font-semibold text-orange-700 mb-1">An&aacute;lisis de publicaci&oacute;n actual</p>
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
                    <th className="text-left p-2 font-medium text-gray-500">Direcci&oacute;n</th>
                    <th className="text-center p-2 font-medium text-gray-500">m&sup2;</th>
                    <th className="text-center p-2 font-medium text-gray-500">Precio</th>
                    <th className="text-center p-2 font-medium text-gray-500">USD/m&sup2;</th>
                    <th className="text-center p-2 font-medium text-gray-500">D&iacute;as</th>
                    <th className="text-center p-2 font-medium text-gray-500">Vistas/d</th>
                  </tr>
                </thead>
                <tbody>
                  {comparables.map((c: any, i: number) => (
                    <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="p-2">
                        <div className="min-w-0">
                          <p className="font-medium text-gray-800 truncate max-w-[150px] sm:max-w-none">{c.address || 'Sin direcci\u00f3n'}</p>
                          {c.zonaprop_url && (
                            <a href={c.zonaprop_url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-indigo-500 hover:underline">
                              Ver aviso &rarr;
                            </a>
                          )}
                        </div>
                      </td>
                      <td className="text-center p-2">{c.total_area || '-'}</td>
                      <td className="text-center p-2 font-semibold text-brand-pink">
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
            <TrendingUp className="w-5 h-5 text-brand-pink" />
            Tasaci&oacute;n proyectada
          </h2>

          <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-6">
            <div className="bg-white/10 rounded-xl p-4 text-center">
              <p className="text-xs text-white/60">Sup. ponderada</p>
              <p className="text-xl sm:text-2xl font-bold">{weighted.toFixed(1)} m&sup2;</p>
            </div>
            <div className="bg-white/10 rounded-xl p-4 text-center">
              <p className="text-xs text-white/60">USD/m&sup2; promedio</p>
              <p className="text-xl sm:text-2xl font-bold">{usdM2.toLocaleString('es-AR')}</p>
            </div>
          </div>

          <div className="space-y-3">
            {a.test_price && (
              <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-white/60">Valor de publicaci&oacute;n prueba</p>
                  <p className="text-xs text-white/40">Primeros 30 d&iacute;as</p>
                </div>
                <p className="text-xl sm:text-2xl font-bold text-yellow-400">
                  USD {Number(a.test_price).toLocaleString('es-AR')}
                </p>
              </div>
            )}

            {a.suggested_price && (
              <div className="bg-brand-pink/20 border border-brand-pink/30 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-white/80 font-semibold">Valor sugerido</p>
                  <p className="text-xs text-white/40">Valor de mercado</p>
                </div>
                <p className="text-2xl sm:text-3xl font-bold text-brand-pink">
                  USD {Number(a.suggested_price).toLocaleString('es-AR')}
                </p>
              </div>
            )}

            {a.expected_close_price && (
              <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-white/60">Precio de cierre esperado</p>
                  <p className="text-xs text-white/40">120 d&iacute;as</p>
                </div>
                <p className="text-xl sm:text-2xl font-bold text-green-400">
                  USD {Number(a.expected_close_price).toLocaleString('es-AR')}
                </p>
              </div>
            )}

            {usdM2 > 0 && (
              <div className="text-center pt-2">
                <p className="text-xs text-white/40">
                  {usdM2.toLocaleString('es-AR')} USD/m&sup2; &times; {weighted.toFixed(1)} m&sup2; = USD {Math.round(usdM2 * weighted).toLocaleString('es-AR')}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="bg-white rounded-2xl shadow-sm p-5 sm:p-8 text-center">
          <img src="/logo.png" alt="Logo" className="h-8 sm:h-10 mx-auto mb-3" />
          <p className="text-sm font-semibold text-gray-800">Marcela Genta &middot; Operaciones Inmobiliarias</p>
          <p className="text-xs text-gray-500 mt-1">{a.agent_name} &middot; {a.agent_phone}</p>
          <p className="text-xs text-gray-400 mt-1">{a.agent_email}</p>
          <p className="text-[10px] text-gray-300 mt-3">
            Todas las operaciones inmobiliarias son objeto de intermediaci&oacute;n y conclusi&oacute;n por parte de Marcela Genta,
            Colegio Profesional Inmobiliario Matr&iacute;cula N&deg;3906
          </p>
        </div>
      </div>
    </div>
  )
}
