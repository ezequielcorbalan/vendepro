import { getCurrentUser } from '@/lib/auth'
import { getDB } from '@/lib/db'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Settings, Palette, FileText, Building, ClipboardList, User, Calendar } from 'lucide-react'
import ProfilePhotoForm from '@/components/settings/ProfilePhotoForm'
import GoogleCalendarSection from '@/components/settings/GoogleCalendarSection'

export default async function ConfiguracionPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  if (user.role !== 'admin' && user.role !== 'owner') redirect('/dashboard')

  const db = await getDB()
  let org: any = null

  try {
    if (user.org_id) {
      org = await db.prepare('SELECT * FROM organizations WHERE id = ?').bind(user.org_id).first()
    }
  } catch {
    // Table might not exist yet
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-semibold text-gray-800 flex items-center gap-2">
          <Settings className="w-6 h-6 text-brand-pink" />
          Configuraci&oacute;n
        </h1>
        <p className="text-brand-gray text-sm mt-1">Ajustes de la inmobiliaria</p>
      </div>

      <div className="space-y-4">
        {/* Profile Photo */}
        <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <User className="w-5 h-5 text-purple-500" />
            Mi perfil
          </h2>
          <ProfilePhotoForm userId={user.id} currentName={user.full_name} currentPhoto={(user as any).photo_url || ''} />
        </div>

        {/* Tasacion Config Link */}
        <Link href="/configuracion/tasacion" className="block bg-white rounded-xl shadow-sm p-4 sm:p-6 hover:shadow-md transition-shadow">
          <h2 className="text-lg font-semibold text-gray-800 mb-1 flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-brand-pink" />
            Configuraci&oacute;n de tasaciones
          </h2>
          <p className="text-sm text-brand-gray">Videos, textos, datos de mercado y CTAs para las landings de tasaci&oacute;n</p>
        </Link>

        {/* Organization Info */}
        <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Building className="w-5 h-5 text-indigo-500" />
            Datos de la inmobiliaria
          </h2>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
              <input
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm bg-gray-50"
                value={org?.name || 'Marcela Genta Operaciones Inmobiliarias'}
                readOnly
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Slug</label>
              <input
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm bg-gray-50"
                value={org?.slug || 'marcela-genta'}
                readOnly
              />
            </div>
          </div>
        </div>

        {/* Google Calendar */}
        <GoogleCalendarSection />

        {/* Branding */}
        <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Palette className="w-5 h-5 text-brand-pink" />
            Marca
          </h2>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Color principal</label>
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-lg border border-gray-200"
                  style={{ backgroundColor: org?.brand_color || '#ff007c' }}
                />
                <input
                  className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm bg-gray-50 w-32"
                  value={org?.brand_color || '#ff007c'}
                  readOnly
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Logo</label>
              <div className="flex items-center gap-3">
                <img src="/logo.png" alt="Logo" className="h-10" />
                <span className="text-xs text-gray-400">Para cambiar el logo, contactanos</span>
              </div>
            </div>
          </div>
        </div>

        {/* Canva Template */}
        <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5 text-brand-orange" />
            Template de Canva (Tasaciones)
          </h2>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ID del Design</label>
              <input
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm bg-gray-50"
                value={org?.canva_template_id || 'DAG6S_gnrsw'}
                readOnly
              />
              <p className="text-xs text-gray-400 mt-1">
                Este es el template que se usa para generar las tasaciones en Canva.
                Pod&eacute;s encontrar el ID en la URL de tu design: canva.com/design/<span className="font-mono text-brand-pink">ID</span>/...
              </p>
            </div>
            {org?.canva_template_id && (
              <a
                href={`https://www.canva.com/design/${org.canva_template_id}/edit`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-indigo-600 hover:underline"
              >
                Ver template en Canva &rarr;
              </a>
            )}
          </div>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-sm text-yellow-800">
          <p className="font-medium mb-1">Pr&oacute;ximamente</p>
          <p className="text-xs text-yellow-600">
            Vas a poder editar todos estos campos directamente, cambiar el template de Canva,
            personalizar colores y logo, e invitar nuevos agentes.
          </p>
        </div>
      </div>
    </div>
  )
}
