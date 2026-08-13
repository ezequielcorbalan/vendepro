'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import {
  Settings, Save, Loader2, Building2, Calendar, User,
  ClipboardList, FileText, CheckCircle, XCircle, Megaphone,
  HelpCircle, PlayCircle, KeyRound, Plug,
} from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { getCurrentUser, resetOnboarding } from '@/lib/auth'
import { useRouter } from 'next/navigation'
import { DEFAULT_SURFACE_WEIGHTS, isValidWeights, type SurfaceWeights } from '@/lib/surface-weights'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Heading, Text } from '@/components/ui/Typography'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Input'
import { Avatar } from '@/components/ui/Avatar'

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

  const navCards = [
    {
      href: '/configuracion/tasacion',
      icon: <ClipboardList className="w-5 h-5" />,
      iconColor: 'text-primary',
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
    ...(isAdmin ? [{
      href: '/configuracion/marketing',
      icon: <Megaphone className="w-5 h-5" />,
      iconColor: 'text-primary',
      title: 'Marketing',
      subtitle: 'Meta Pixel + GTM + tracking de leads',
    }, {
      href: '/configuracion/api',
      icon: <KeyRound className="w-5 h-5" />,
      iconColor: 'text-purple-500',
      title: 'Configuración de API',
      subtitle: 'Tokens para importar leads',
    }, {
      href: '/configuracion/conexiones',
      icon: <Plug className="w-5 h-5" />,
      iconColor: 'text-amber-500',
      title: 'Integraciones',
      subtitle: 'Importación automática de contactos',
    }] : []),
  ]

  return (
    <div className="space-y-6">
      <PageHeader title="Configuración" subtitle="Ajustes de la inmobiliaria" />

      {/* Mi perfil */}
      <Card className="p-6">
        <Heading level={4} className="mb-5 flex items-center gap-2">
          <User className="w-4 h-4 text-gray-600" /> Mi perfil
        </Heading>
        {loadingProfile ? (
          <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <Avatar name={profile?.full_name || 'Usuario'} src={profile?.photo_url} size="lg" className="w-14 h-14 text-xl" />
              <div>
                <Text weight="medium">{profile?.full_name || 'Usuario'}</Text>
                <Text tone="muted">Esta foto aparece en las tasaciones</Text>
              </div>
            </div>
            <Field
              label="URL de foto de perfil"
              hint="Podés subir tu foto a un servicio como imgur.com y pegar el link"
            >
              <Input
                type="url"
                value={photoUrl}
                onChange={e => setPhotoUrl(e.target.value)}
                placeholder="https://ejemplo.com/mi-foto.jpg"
              />
            </Field>
            <Button onClick={handleSavePhoto} loading={savingPhoto} icon={<Save className="w-4 h-4" />}>
              Guardar foto
            </Button>
          </div>
        )}
      </Card>

      {/* Nav cards 2x2 */}
      <div className="grid grid-cols-2 gap-4">
        {navCards.map(card => (
          <Link key={card.href} href={card.href}>
            <Card interactive className="h-full hover:border-gray-300 transition-all">
              <div className={`mb-2 ${card.iconColor}`}>{card.icon}</div>
              <Text weight="semibold">{card.title}</Text>
              <Text size="xs" tone="muted" className="mt-0.5">{card.subtitle}</Text>
            </Card>
          </Link>
        ))}
      </div>

      {/* Datos de la inmobiliaria — solo admin */}
      {isAdmin && <Card className="p-6">
        <Heading level={4} className="mb-5 flex items-center gap-2">
          <Building2 className="w-4 h-4 text-indigo-500" /> Datos de la inmobiliaria
        </Heading>
        {loadingOrg ? (
          <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
        ) : (
          <div className="space-y-4">
            <Field label="Nombre">
              <Input type="text" value={orgName} disabled />
            </Field>
            <Field label="Slug" error={slugStatus === 'taken' ? 'Ya está en uso' : undefined}>
              <div className="relative">
                <Input
                  type="text"
                  value={slug}
                  onChange={e => setSlug(e.target.value)}
                  placeholder="mi-inmobiliaria"
                  className="pr-8"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {slugStatus === 'checking' && <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />}
                  {slugStatus === 'available' && <CheckCircle className="w-4 h-4 text-success" />}
                  {slugStatus === 'taken' && <XCircle className="w-4 h-4 text-danger" />}
                </div>
              </div>
            </Field>

            <div className="border-t pt-4">
              <Text as="h3" weight="semibold" className="mb-1">Marca</Text>
              <Text size="xs" tone="muted" className="mb-3">
                Estos colores y el logo se usan en las tasaciones que ven tus clientes.
              </Text>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Color principal">
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={brandColor}
                      onChange={e => setBrandColor(e.target.value)}
                      className="h-10 w-12 cursor-pointer rounded-control border border-gray-300"
                    />
                    <Input
                      type="text"
                      value={brandColor}
                      onChange={e => setBrandColor(e.target.value)}
                      placeholder="#ff007c"
                      className="flex-1 font-mono"
                    />
                  </div>
                </Field>
                <Field label="Color secundario">
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={brandAccentColor}
                      onChange={e => setBrandAccentColor(e.target.value)}
                      className="h-10 w-12 cursor-pointer rounded-control border border-gray-300"
                    />
                    <Input
                      type="text"
                      value={brandAccentColor}
                      onChange={e => setBrandAccentColor(e.target.value)}
                      placeholder="#e17a2a"
                      className="flex-1 font-mono"
                    />
                  </div>
                </Field>
              </div>

              <div className="mt-3">
                <Text size="xs" tone="muted" className="mb-1">Vista previa del gradient:</Text>
                <div
                  className="h-10 rounded-control"
                  style={{ background: `linear-gradient(180deg, ${brandColor} 0%, ${brandAccentColor} 100%)` }}
                />
              </div>

              <div className="mt-4">
                <Field label="Logo (URL)">
                  <Input
                    type="url"
                    value={logoUrl}
                    onChange={e => setLogoUrl(e.target.value)}
                    placeholder="https://ejemplo.com/logo.png"
                  />
                </Field>
                {logoUrl && (
                  <div className="mt-2 inline-block rounded-control border border-gray-200 bg-gray-50 p-2">
                    <img src={logoUrl} alt="Logo" className="h-10 max-w-[200px] object-contain" />
                  </div>
                )}
              </div>
            </div>

            <div className="border-t pt-4">
              <Text as="h3" weight="semibold" className="mb-1">Ponderación de superficies</Text>
              <Text size="xs" tone="muted" className="mb-3">
                Pesos que se usan para calcular la <strong>superficie ponderada</strong> en cada tasación.
                Fórmula: <span className="font-mono text-[11px]">cubierta × % + semicubierta × % + descubierta × %</span>.
              </Text>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Cubierta">
                  <div className="relative">
                    <Input
                      type="number"
                      min={0}
                      max={150}
                      step={5}
                      value={Math.round(surfaceWeights.covered * 100)}
                      onChange={e => setWeight('covered', Number(e.target.value))}
                      className="pr-8"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">%</span>
                  </div>
                </Field>
                <Field label="Semicubierta">
                  <div className="relative">
                    <Input
                      type="number"
                      min={0}
                      max={150}
                      step={5}
                      value={Math.round(surfaceWeights.semi * 100)}
                      onChange={e => setWeight('semi', Number(e.target.value))}
                      className="pr-8"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">%</span>
                  </div>
                </Field>
                <Field label="Descubierta">
                  <div className="relative">
                    <Input
                      type="number"
                      min={0}
                      max={150}
                      step={5}
                      value={Math.round(surfaceWeights.uncovered * 100)}
                      onChange={e => setWeight('uncovered', Number(e.target.value))}
                      className="pr-8"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">%</span>
                  </div>
                </Field>
              </div>
              <Text size="xs" tone="muted" className="mt-2">
                Estándar argentino: 100 / 75 / 25. Cambialo si tu inmobiliaria usa otra ponderación.
              </Text>
            </div>

            <Button
              onClick={handleSaveOrg}
              loading={savingOrg}
              disabled={slugStatus === 'taken'}
              icon={<Save className="w-4 h-4" />}
            >
              Guardar
            </Button>
          </div>
        )}
      </Card>}

      {/* Ayuda */}
      <Card className="p-6">
        <Heading level={4} className="mb-3 flex items-center gap-2">
          <HelpCircle className="w-4 h-4 text-gray-600" /> Ayuda
        </Heading>
        <Text tone="muted" className="mb-4">
          Volvé a ver el tutorial de bienvenida para repasar cómo funciona el sistema.
        </Text>
        <Button
          onClick={() => {
            const user = getCurrentUser()
            if (user) { resetOnboarding(user.id); router.push('/dashboard') }
          }}
          icon={<PlayCircle className="w-4 h-4" />}
        >
          Ver tutorial de nuevo
        </Button>
      </Card>

      {/* Google Calendar */}
      <Card className="p-6">
        <Heading level={4} className="mb-3 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-blue-500" /> Google Calendar
        </Heading>
        <Text tone="muted" className="mb-3">
          Conectá tu Google Calendar para ver tus eventos en el CRM y sincronizar automáticamente.
        </Text>
        <div className="mb-4">
          <Text size="xs" tone="muted" className="mb-2">
            El CRM clasifica automáticamente tus eventos según palabras clave:
          </Text>
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
          <Text size="xs" tone="muted" className="mt-2">
            También vincula eventos a leads/contactos si mencionás su nombre en el título.
          </Text>
        </div>        <Button
          onClick={() => toast('Integración con Google Calendar próximamente')}
          icon={<Calendar className="w-4 h-4" />}
        >
          Conectar Google Calendar
        </Button>
      </Card>
    </div>
  )
}
