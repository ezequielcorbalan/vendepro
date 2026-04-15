import { getCurrentUser } from '@/lib/auth'
import { getDB } from '@/lib/db'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plus, ClipboardList, ExternalLink, MapPin, Pencil } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import DeleteTasacionButton from '@/components/tasaciones/DeleteTasacionButton'

export default async function TasacionesPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const db = await getDB()
  const isAdmin = user.role === 'admin' || user.role === 'owner'

  const query = isAdmin
    ? `SELECT a.*, u.full_name as agent_name FROM appraisals a LEFT JOIN users u ON a.agent_id = u.id ORDER BY a.created_at DESC`
    : `SELECT a.* FROM appraisals a WHERE a.agent_id = ? ORDER BY a.created_at DESC`

  let appraisals: any[] = []
  try {
    appraisals = isAdmin
      ? (await db.prepare(query).all()).results as any[]
      : (await db.prepare(query).bind(user.id).all()).results as any[]
  } catch {
    appraisals = []
  }

  const statusLabels: Record<string, { label: string; color: string }> = {
    draft: { label: 'Borrador', color: 'bg-gray-100 text-gray-700' },
    published: { label: 'Publicada', color: 'bg-green-100 text-green-700' },
    sent: { label: 'Enviada', color: 'bg-blue-100 text-blue-700' },
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-800">Tasaciones</h1>
          <p className="text-brand-gray text-sm mt-1">Genera tasaciones profesionales para propietarios</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Link href="/configuracion/tasacion" className="inline-flex items-center gap-2 border border-gray-300 text-gray-700 px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50">
            Configurar
          </Link>
          <Link href="/prefactibilidades/nueva" className="inline-flex items-center gap-2 border border-orange-300 bg-orange-50 text-orange-700 px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-orange-100">
            <Plus className="w-4 h-4" /> Prefactibilidad
          </Link>
          <Link href="/tasaciones/nueva" className="inline-flex items-center gap-2 bg-brand-pink text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:opacity-90">
            <Plus className="w-4 h-4" /> Nueva tasaci&oacute;n
          </Link>
        </div>
      </div>

      {appraisals.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-8 sm:p-12 text-center">
          <ClipboardList className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h2 className="text-lg font-medium text-gray-600 mb-2">Sin tasaciones</h2>
          <p className="text-gray-400 text-sm mb-6">Cre&aacute; tu primera tasaci&oacute;n</p>
          <Link href="/tasaciones/nueva" className="inline-flex items-center gap-2 bg-brand-pink text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:opacity-90">
            <Plus className="w-4 h-4" /> Crear tasaci&oacute;n
          </Link>
        </div>
      ) : (
        <div className="grid gap-3">
          {appraisals.map((a: any) => {
            const st = statusLabels[a.status] || statusLabels.draft
            return (
              <div key={a.id} className="bg-white rounded-xl shadow-sm p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <Link href={`/tasaciones/${a.id}`} className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-gray-800 truncate">{a.property_address}</h3>
                    <span className={`text-[10px] sm:text-xs px-2 py-0.5 rounded-full font-medium ${st.color}`}>{st.label}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs sm:text-sm text-gray-500">
                    <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {a.neighborhood}</span>
                    {a.suggested_price && <span className="font-medium text-brand-pink">USD {Number(a.suggested_price).toLocaleString('es-AR')}</span>}
                    <span>{formatDate(a.created_at)}</span>
                  </div>
                  {isAdmin && a.agent_name && <p className="text-xs text-gray-400 mt-1">Agente: {a.agent_name}</p>}
                </Link>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Link href={`/tasaciones/${a.id}/editar`} className="inline-flex items-center gap-1 text-xs text-gray-600 bg-gray-100 px-3 py-1.5 rounded-lg hover:bg-gray-200">
                    <Pencil className="w-3 h-3" /> Editar
                  </Link>
                  {a.public_slug && (
                    <a href={`/t/${a.public_slug}`} target="_blank" className="inline-flex items-center gap-1 text-xs text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg hover:bg-indigo-100">
                      <ExternalLink className="w-3 h-3" /> Landing
                    </a>
                  )}
                  <DeleteTasacionButton tasacionId={a.id} />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
