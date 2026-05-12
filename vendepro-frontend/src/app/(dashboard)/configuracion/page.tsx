'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import {
  Settings, Save, Loader2, Building2, Calendar, User,
  ClipboardList, FileText, CheckCircle, XCircle, Megaphone,
  HelpCircle, PlayCircle, MessageCircle,
} from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { getCurrentUser, resetOnboarding } from '@/lib/auth'
import { useRouter } from 'next/navigation'
import { DEFAULT_SURFACE_WEIGHTS, isValidWeights, type SurfaceWeights } from '@/lib/surface-weights'

export default function ConfiguracionPage() {
  const { toast } = useToast()
  const router = useRouter()
  const isAdmin = getCurrentUser()?.role === 'admin'
  const [loadingProfile, setLoadingProfile] = useState(true)
  const [loadingOrg, setLoadingOrg] = useState(true)
  const [profile, setProfile] = useState<any>(null)
  const [photoUrl, setPhotoUrl] = useState('')
  const [savingPhoto, setSavingPhoto] = useState(false)

  const [orgName, setOrgName] = useState('')
  const [slug, setSlug] = useState('')
  const [brandColor, setBrandColor] = useState('#ff007c')
  const [brandAccentColor, setBrandAccentColor] = useState('#e17a2a')
  const [logoUrl, setLogoUrl] = useState('')
  const [surfaceWeights, setSurfaceWeights] = useState<SurfaceWeights>(DEFAULT_SURFACE_WEIGHTS)
  const [savingOrg, setSavingOrg] = useState(false)
  const slugDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const initialSlugRef = useRef<string>('')
  const [slugStatus, setSlugStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle')

  useEffect(() => {
    apiFetch('admin', '/profile').then(r => r.json() as Promise<any>).then(d => {
      setProfile(d)
      setPhotoUrl(d.photo_url || '')
      setLoadingProfile(false)
    }).catch(() => setLoadingProfile(false))

    if (isAdmin) {
      apiFetch('admin', '/org-settings').then(r => r.json() as Promise<any>).then(d => {
        setOrgName(d.name || '')
        setSlug(d.slug || '')
        setBrandColor(d.brand_color || '#ff007c')
        setBrandAccentColor(d.brand_accent_color || '#e17a2a')
        setLogoUrl(d.logo_url || '')
        if (isValidWeights(d.surface_weights)) setSurfaceWeights(d.surface_weights)
        initialSlugRef.current = d.slug || ''
        setLoadingOrg(false)
      }).catch(() => setLoadingOrg(false))
    } else {
      setLoadingOrg(false)
    }
  }, [])

  useEffect(() => {
    if (!slug || slug === initialSlugRef.current) { setSlugStatus('idle'); return }
    if (slugDebounceRef.current) clearTimeout(slugDebounceRef.current)
    setSlugStatus('checking')
    slugDebounceRef.current = setTimeout(async () => {
      try {
        const res = await apiFetch('auth', `/check-slug?slug=${encodeURIComponent(slug)}`)
        const data = (await res.json()) as any
        if (data.slug) setSlug(data.slug)
        setSlugStatus(data.available ? 'available' : 'taken')
      } catch {
        setSlugStatus('idle')
      }
    }, 500)
  }, [slug])

  const handleSavePhoto = async () => {
    setSavingPhoto(true)
    try {
      const res = await apiFetch('admin', '/profile', {
        method: 'PUT',
        body: JSON.stringify({ full_name: profile?.full_name, phone: profile?.phone, photo_url: photoUrl }),
      })
      const data = (await res.json()) as any
      if (data.error) toast(data.error, 'error')
      else { toast('Foto actualizada'); setProfile((p: any) => ({ ...p, photo_url: photoUrl })) }
    } catch { toast('Error al guardar', 'error') }
    setSavingPhoto(false)
  }

  const handleSaveOrg = async () => {
    setSavingOrg(true)
    try {
      const res = await apiFetch('admin', '/org-settings', {
        method: 'PUT',
        body: JSON.stringify({
          name: orgName,
          slug,
          brand_color: brandColor,
          brand_accent_color: brandAccentColor,
          logo_url: logoUrl || null,
          surface_weights: surfaceWeights,
        }),
      })
      const data = (await res.json()) as any
      if (data.error) toast(data.error, 'error')
      else toast('Datos guardados')
    } catch { toast('Error al guardar', 'error') }
    setSavingOrg(false)
  }

  const setWeight = (k: keyof SurfaceWeights, pct: number) => {
    setSurfaceWeights(w => ({ ...w, [k]: Math.max(0, Math.min(150, pct)) / 100 }))
  }

  const initial = profile?.full_name?.charAt(0)?.toUpperCase() || 'U'

  const navCards = [
    {
      href: '/configuracion/tasacion',
      icon: <ClipboardList className="w-5 h-5" />,
      iconColor: 'text-[#ff007c]',
      title: 'Tasaciones',
      subtitle: 'Bloques, marca y datos de mercado',
    },
    {
      href: '/perfil',
      icon: <FileText className="w-5 h-5" />,
      iconColor: 'text-purple-500',
      title: 'Mi Performance',
      subtitle: 'Métricas y rendimiento personal',
    },
    {
      href: '/configuracion/objetivos',
      icon: <Settings className="w-5 h-5" />,
      iconColor: 'text-orange-500',
      title: 'Mis Objetivos',
      subtitle: 'Metas y seguimiento',
    },
    ...(isAdmin ? [
      {
        href: '/configuracion/marketing',
        icon: <Megaphone className="w-5 h-5" />,
        iconColor: 'text-pink-600',
        title: 'Marketing',
        subtitle: 'Meta Pixel + GTM + tracking de leads',
      },
      {
        href: '/configuracion/whatsapp',
        icon: <MessageCircle className="w-5 h-5" />,
        iconColor: 'text-green-600',
        title: 'WhatsApp Bot',
        subtitle: 'Auto-respuesta y calificación de leads',
      },
    ] : []),
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold text-gray-800 flex items-center gap-2">
          <Settings className="w-6 h-6 text-[#ff007c]" /> Configuración
        </h1>
        <p className="text-gray-500 text-sm mt-1">Ajustes de la inmobiliaria</p>
      </div>

      {/* Mi perfil */}
      <div className="bg-white rounded-xl border p-6">
        <h2 className="font-semibold text-gray-800 mb-5 flex items-center gap-2">
          <User className="w-4 h-4 text-[#ff007c]" /> Mi perfil
        </h2>
        {loadingProfile ? (
          <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              {profile?.photo_url ? (
                <img src={profile.photo_url} alt={profile.full_name} className="w-14 h-14 rounded-full object-cover" />
              ) : (
                <div className="w-14 h-14 rounded-full bg-pink-100 flex items-center justify-center text-xl font-semibold text-[#ff007c]">
                  {initial}
                </div>
              )}
              <div>
                <p className="font-medium text-gray-800">{profile?.full_name || 'Usuario'}</p>
                <p className="text-sm text-gray-500">Esta foto aparece en las tasaciones</p>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">URL de foto de perfil</label>
              <input
                type="url"
                value={photoUrl}
                onChange={e => setPhotoUrl(e.target.value)}
                placeholder="https://ejemplo.com/mi-foto.jpg"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff007c]/50 focus:border-[#ff007c]"
              />
              <p className="text-xs text-gray-400 mt-1">Podés subir tu foto a un servicio como imgur.com y pegar el link</p>
            </div>
            <button
              onClick={handleSavePhoto}
              disabled={savingPhoto}
              className="flex items-center gap-2 bg-[#ff007c] text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50"
            >
              {savingPhoto ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Guardar foto
            </button>
          </div>
        )}
      </div>

      {/* Nav cards 2x2 */}
      <div className="grid grid-cols-2 gap-4">
        {navCards.map(card => (
          <Link
            key={card.href}
            href={card.href}
            className="bg-white rounded-xl border p-5 hover:shadow-sm hover:border-gray-300 transition-all"
          >
            <div className={`mb-2 ${card.iconColor}`}>{card.icon}</div>
            <p className="font-semibold text-gray-800 text-sm">{card.title}</p>
            <p className="text-xs text-gray-500 mt-0.5">{card.subtitle}</p>
          </Link>
        ))}
      </div>

      {/* Datos de la inmobiliaria — solo admin */}
      {isAdmin && <div className="bg-white rounded-xl border p-6">
        <h2 className="font-semibold text-gray-800 mb-5 flex items-center gap-2">
          <Building2 className="w-4 h-4 text-indigo-500" /> Datos de la inmobiliaria
        </h2>
        {loadingOrg ? (
          <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
              <input
                type="text"
                value={orgName}
                disabled
                className="w-full border rounded-lg px-3 py-2.5 text-sm bg-gray-50 text-gray-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Slug</label>
              <div className="relative">
                <input
                  type="text"
                  value={slug}
                  onChange={e => setSlug(e.target.value)}
                  placeholder="mi-inmobiliaria"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff007c]/50 focus:border-[#ff007c] pr-8"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {slugStatus === 'checking' && <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />}
                  {slugStatus === 'available' && <CheckCircle className="w-4 h-4 text-green-500" />}
                  {slugStatus === 'taken' && <XCircle className="w-4 h-4 text-red-500" />}
                </div>
              </div>
              {slugStatus === 'taken' && <p className="text-xs text-red-600 mt-1">Ya está en uso</p>}
            </div>

            <div className="border-t pt-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-1">Marca</h3>
              <p className="text-xs text-gray-500 mb-3">
                Estos colores y el logo se usan en las tasaciones que ven tus clientes.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Color principal</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={brandColor}
                      onChange={e => setBrandColor(e.target.value)}
                      className="h-10 w-12 cursor-pointer rounded border border-gray-300"
                    />
                    <input
                      type="text"
                      value={brandColor}
                      onChange={e => setBrandColor(e.target.value)}
                      placeholder="#ff007c"
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#ff007c]/50"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Color secundario</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={brandAccentColor}
                      onChange={e => setBrandAccentColor(e.target.value)}
                      className="h-10 w-12 cursor-pointer rounded border border-gray-300"
                    />
                    <input
                      type="text"
                      value={brandAccentColor}
                      onChange={e => setBrandAccentColor(e.target.value)}
                      placeholder="#e17a2a"
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#ff007c]/50"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-3">
                <p className="text-xs text-gray-500 mb-1">Vista previa del gradient:</p>
                <div
                  className="h-10 rounded-lg"
                  style={{ background: `linear-gradient(180deg, ${brandColor} 0%, ${brandAccentColor} 100%)` }}
                />
              </div>

              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Logo (URL)</label>
                <input
                  type="url"
                  value={logoUrl}
                  onChange={e => setLogoUrl(e.target.value)}
                  placeholder="https://ejemplo.com/logo.png"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff007c]/50 focus:border-[#ff007c]"
                />
                {logoUrl && (
                  <div className="mt-2 inline-block rounded border border-gray-200 bg-gray-50 p-2">
                    <img src={logoUrl} alt="Logo" className="h-10 max-w-[200px] object-contain" />
                  </div>
                )}
              </div>
            </div>

            <div className="border-t pt-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-1">Ponderación de superficies</h3>
              <p className="text-xs text-gray-500 mb-3">
                Pesos que se usan para calcular la <strong>superficie ponderada</strong> en cada tasación.
                Fórmula: <span className="font-mono text-[11px]">cubierta × % + semicubierta × % + descubierta × %</span>.
              </p>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Cubierta</label>
                  <div className="relative">
                    <input
                      type="number"
                      min={0}
                      max={150}
                      step={5}
                      value={Math.round(surfaceWeights.covered * 100)}
                      onChange={e => setWeight('covered', Number(e.target.value))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm pr-8 focus:outline-none focus:ring-2 focus:ring-[#ff007c]/50"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">%</span>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Semicubierta</label>
                  <div className="relative">
                    <input
                      type="number"
                      min={0}
                      max={150}
                      step={5}
                      value={Math.round(surfaceWeights.semi * 100)}
                      onChange={e => setWeight('semi', Number(e.target.value))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm pr-8 focus:outline-none focus:ring-2 focus:ring-[#ff007c]/50"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">%</span>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Descubierta</label>
                  <div className="relative">
                    <input
                      type="number"
                      min={0}
                      max={150}
                      step={5}
                      value={Math.round(surfaceWeights.uncovered * 100)}
                      onChange={e => setWeight('uncovered', Number(e.target.value))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm pr-8 focus:outline-none focus:ring-2 focus:ring-[#ff007c]/50"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">%</span>
                  </div>
                </div>
              </div>
              <p className="mt-2 text-xs text-gray-500">
                Estándar argentino: 100 / 75 / 25. Cambialo si tu inmobiliaria usa otra ponderación.
              </p>
            </div>

            <button
              onClick={handleSaveOrg}
              disabled={savingOrg || slugStatus === 'taken'}
              className="flex items-center gap-2 bg-[#ff007c] text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50"
            >
              {savingOrg ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Guardar
            </button>
          </div>
        )}
      </div>}

      {/* Ayuda */}
      <div className="bg-white rounded-xl border p-6">
        <h2 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
          <HelpCircle className="w-4 h-4 text-[#ff007c]" /> Ayuda
        </h2>
        <p className="text-sm text-gray-600 mb-4">
          Volvé a ver el tutorial de bienvenida para repasar cómo funciona el sistema.
        </p>
        <button
          onClick={() => {
            const user = getCurrentUser()
            if (user) { resetOnboarding(user.id); router.push('/dashboard') }
          }}
          className="flex items-center gap-2 bg-gradient-to-r from-[#ff007c] to-[#ff8017] text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <PlayCircle className="w-4 h-4" />
          Ver tutorial de nuevo
        </button>
      </div>

      {/* Google Calendar */}
      <div className="bg-white rounded-xl border p-6">
        <h2 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-blue-500" /> Google Calendar
        </h2>
        <p className="text-sm text-gray-600 mb-3">
          Conectá tu Google Calendar para ver tus eventos en el CRM y sincronizar automáticamente.
        </p>
        <div className="mb-4">
          <p className="text-xs text-gray-400 mb-2">
            El CRM clasifica automáticamente tus eventos según palabras clave:
          </p>
          <div className="flex flex-wrap gap-2">
            {[
              ['"llamada"', 'Llamada'],
              ['"reunión"', 'Reunión'],
              ['"visita"', 'Visita'],
              ['"tasación"', 'Tasación'],
              ['"seguimiento"', 'Seguimiento'],
              ['"firma"', 'Firma'],
            ].map(([kw, label]) => (
              <span key={kw} className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                {kw} → {label}
              </span>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-2">
            También vincula eventos a leads/contactos si mencionás su nombre en el título.
          </p>
        </div>
        <button
          onClick={() => toast('Integración con Google Calendar próximamente')}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
        >
          <Calendar className="w-4 h-4" />
          Conectar Google Calendar
        </button>
      </div>
    </div>
  )
}
