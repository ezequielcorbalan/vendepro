'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { CheckCircle, XCircle, Loader2, ChevronRight } from 'lucide-react'
import { apiFetch, setToken } from '@/lib/api'
import { setCurrentUser } from '@/lib/auth'

type Step = 1 | 2 | 3

interface FormData {
  org_name: string
  org_slug: string
  admin_name: string
  email: string
  password: string
  logo_url: string
  brand_color: string
}

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

export default function RegisterPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [slugStatus, setSlugStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle')
  const slugDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [form, setForm] = useState<FormData>({
    org_name: '',
    org_slug: '',
    admin_name: '',
    email: '',
    password: '',
    logo_url: '',
    brand_color: '#ff007c',
  })

  function update(field: keyof FormData, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  // Auto-generate slug from org_name
  useEffect(() => {
    if (step !== 1) return
    const slug = generateSlug(form.org_name)
    setForm(prev => ({ ...prev, org_slug: slug }))
  }, [form.org_name])

  // Validate slug availability with debounce
  useEffect(() => {
    if (!form.org_slug) { setSlugStatus('idle'); return }
    if (slugDebounceRef.current) clearTimeout(slugDebounceRef.current)
    setSlugStatus('checking')
    slugDebounceRef.current = setTimeout(async () => {
      try {
        const res = await apiFetch('auth', `/check-slug?slug=${encodeURIComponent(form.org_slug)}`)
        const data = (await res.json()) as any
        if (data.slug) setForm(prev => ({ ...prev, org_slug: data.slug }))
        setSlugStatus(data.available ? 'available' : 'taken')
      } catch {
        setSlugStatus('idle')
      }
    }, 500)
  }, [form.org_slug])

  function handleStep1Next(e: React.FormEvent) {
    e.preventDefault()
    if (slugStatus === 'taken') { setError('El nombre de inmobiliaria ya está en uso'); return }
    setError('')
    setStep(2)
  }

  async function handleStep2Submit(e: React.FormEvent) {
    e.preventDefault()
    if (form.password.length < 8) { setError('La contraseña debe tener al menos 8 caracteres'); return }
    setLoading(true)
    setError('')
    try {
      const res = await apiFetch('auth', '/register-org', {
        method: 'POST',
        body: JSON.stringify({
          org_name: form.org_name,
          org_slug: form.org_slug,
          admin_name: form.admin_name,
          email: form.email,
          password: form.password,
          logo_url: null,
          brand_color: '#ff007c',
        }),
      })
      const data = (await res.json()) as any
      if (!res.ok) {
        if (data.code === 'CONFLICT_ERROR' && data.error?.includes('inmobiliaria')) {
          setError(data.error)
          setStep(1)
        } else {
          setError(data.error || 'Error al crear la cuenta')
        }
        setLoading(false)
        return
      }
      // Auto-login
      setToken(data.token)
      document.cookie = `vendepro_token=${data.token}; path=/; SameSite=Lax; Max-Age=${60 * 60 * 24 * 30}`
      setCurrentUser({
        id: data.user.id,
        email: data.user.email,
        full_name: data.user.name ?? '',
        name: data.user.name ?? '',
        role: data.user.role,
        org_id: data.user.org_id,
        phone: null,
        photo_url: null,
      })
      setStep(3)
    } catch {
      setError('Error de conexión. Intentá de nuevo.')
    }
    setLoading(false)
  }

  async function handleStep3Save(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      await apiFetch('admin', '/org-settings', {
        method: 'PUT',
        body: JSON.stringify({
          name: form.org_name,
          logo_url: form.logo_url || null,
          brand_color: form.brand_color,
          canva_template_id: null,
          canva_report_template_id: null,
        }),
      })
    } catch {
      // Don't block access if personalization save fails
    }
    router.push('/dashboard')
    router.refresh()
  }

  const inputClass = 'w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff007c]/50 focus:border-[#ff007c]'

  const STEPS = ['Tu inmobiliaria', 'Tu cuenta', 'Personalización']

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-8">
      <div className="bg-white rounded-2xl shadow-lg p-5 sm:p-8 w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-6">
          <img src="/logo.png" alt="VendéPro" className="h-12 mx-auto mb-3" />
          <h1 className="text-xl font-semibold text-gray-800">Registrá tu inmobiliaria</h1>
        </div>

        {/* Progress bar */}
        <div className="flex items-center mb-8">
          {STEPS.map((label, i) => {
            const n = (i + 1) as Step
            const isActive = step === n
            const isDone = step > n
            return (
              <div key={n} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold border-2 transition-colors ${
                    isDone ? 'bg-[#ff007c] border-[#ff007c] text-white' :
                    isActive ? 'border-[#ff007c] text-[#ff007c]' :
                    'border-gray-300 text-gray-400'
                  }`}>
                    {isDone ? '✓' : n}
                  </div>
                  <span className={`text-xs mt-1 hidden sm:block ${isActive ? 'text-[#ff007c] font-medium' : 'text-gray-400'}`}>
                    {label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`h-0.5 flex-1 mx-1 transition-colors ${step > n ? 'bg-[#ff007c]' : 'bg-gray-200'}`} />
                )}
              </div>
            )
          })}
        </div>

        {error && <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg mb-4">{error}</div>}

        {/* STEP 1 */}
        {step === 1 && (
          <form onSubmit={handleStep1Next} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre de la inmobiliaria *</label>
              <input
                type="text"
                value={form.org_name}
                onChange={e => update('org_name', e.target.value)}
                required
                placeholder="Ej: Genta Inmobiliaria"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Identificador único (URL)
                <span className="text-gray-400 font-normal ml-1 text-xs">— se usa en links públicos</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={form.org_slug}
                  onChange={e => update('org_slug', e.target.value)}
                  required
                  placeholder="genta-inmobiliaria"
                  className={`${inputClass} pr-8`}
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {slugStatus === 'checking' && <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />}
                  {slugStatus === 'available' && <CheckCircle className="w-4 h-4 text-green-500" />}
                  {slugStatus === 'taken' && <XCircle className="w-4 h-4 text-red-500" />}
                </div>
              </div>
              {slugStatus === 'available' && <p className="text-xs text-green-600 mt-1">Disponible</p>}
              {slugStatus === 'taken' && <p className="text-xs text-red-600 mt-1">Ya está en uso, elegí otro</p>}
            </div>
            <button
              type="submit"
              disabled={slugStatus === 'taken' || slugStatus === 'checking' || !form.org_name}
              className="w-full bg-[#ff007c] text-white font-medium py-2.5 rounded-lg hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              Continuar <ChevronRight className="w-4 h-4" />
            </button>
          </form>
        )}

        {/* STEP 2 */}
        {step === 2 && (
          <form onSubmit={handleStep2Submit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tu nombre completo *</label>
              <input
                type="text"
                value={form.admin_name}
                onChange={e => update('admin_name', e.target.value)}
                required
                placeholder="Marcela Genta"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
              <input
                type="email"
                value={form.email}
                onChange={e => update('email', e.target.value)}
                required
                placeholder="marcela@genta.com"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña *</label>
              <input
                type="password"
                value={form.password}
                onChange={e => update('password', e.target.value)}
                required
                minLength={8}
                placeholder="Mínimo 8 caracteres"
                className={inputClass}
              />
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => { setStep(1); setError('') }}
                className="flex-1 border border-gray-300 text-gray-700 font-medium py-2.5 rounded-lg hover:bg-gray-50"
              >
                Atrás
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-[#ff007c] text-white font-medium py-2.5 rounded-lg hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {loading ? 'Creando...' : 'Crear cuenta'}
              </button>
            </div>
          </form>
        )}

        {/* STEP 3 — Optional personalization */}
        {step === 3 && (
          <form onSubmit={handleStep3Save} className="space-y-4">
            <p className="text-sm text-gray-500 -mt-2 mb-2">
              Podés configurar esto ahora o después desde <strong>Configuración</strong>.
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">URL del logo</label>
              <input
                type="url"
                value={form.logo_url}
                onChange={e => update('logo_url', e.target.value)}
                placeholder="https://tuinmobiliaria.com/logo.png"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Color de marca</label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={form.brand_color}
                  onChange={e => update('brand_color', e.target.value)}
                  className="h-10 w-16 rounded border border-gray-300 cursor-pointer p-1"
                />
                <span className="text-sm text-gray-500 font-mono">{form.brand_color}</span>
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#ff007c] text-white font-medium py-2.5 rounded-lg hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Guardar y entrar
            </button>
            <button
              type="button"
              onClick={() => { router.push('/dashboard'); router.refresh() }}
              className="w-full text-gray-500 text-sm py-2 hover:text-gray-700"
            >
              Saltar por ahora
            </button>
          </form>
        )}

        {step < 3 && (
          <p className="text-center text-sm text-gray-500 mt-6">
            ¿Ya tenés cuenta?{' '}
            <Link href="/login" className="text-[#ff007c] hover:underline font-medium">
              Ingresá acá
            </Link>
          </p>
        )}
      </div>
    </div>
  )
}
