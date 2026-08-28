'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { CheckCircle, XCircle, Loader2, ChevronRight } from 'lucide-react'
import { apiFetch, setToken } from '@/lib/api'
import { setCurrentUser } from '@/lib/auth'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Input'
import { Heading, Text } from '@/components/ui/Typography'
import { Alert } from '@/components/ui/Alert'

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

  const STEPS = ['Tu inmobiliaria', 'Tu cuenta', 'Personalización']

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-8">
      <div className="bg-white rounded-2xl shadow-lg p-5 sm:p-8 w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-6">
          <img src="/brand/logo-horizontal.png" alt="VendéPro" className="h-12 mx-auto mb-3" />
          <Heading level={3}>Registrá tu inmobiliaria</Heading>
        </div>

        {/* Progress bar — stepper numerado con label y línea de unión.
            ds-todo: candidato a componente "StepIndicator". Hay TRES diseños de
            stepper distintos en la app (este de círculos+labels, los dots de
            components/onboarding/StepIndicator, y las pills segmentadas de
            components/tasaciones/wizard/WizardShell). Unificarlos es una decisión
            de diseño: hay que elegir cuál gana antes de crear el componente. */}
        <div className="flex items-center mb-8">
          {STEPS.map((label, i) => {
            const n = (i + 1) as Step
            const isActive = step === n
            const isDone = step > n
            return (
              <div key={n} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold border-2 transition-colors ${
                    isDone ? 'bg-primary border-primary text-white' :
                    isActive ? 'border-primary text-primary' :
                    'border-gray-300 text-gray-400'
                  }`}>
                    {isDone ? '✓' : n}
                  </div>
                  <span className={`text-xs mt-1 hidden sm:block ${isActive ? 'text-primary font-medium' : 'text-gray-400'}`}>
                    {label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`h-0.5 flex-1 mx-1 transition-colors ${step > n ? 'bg-primary' : 'bg-gray-200'}`} />
                )}
              </div>
            )
          })}
        </div>

        {error && <Alert tone="danger" className="mb-4">{error}</Alert>}

        {/* STEP 1 */}
        {step === 1 && (
          <form onSubmit={handleStep1Next} className="space-y-4">
            <Field label="Nombre de la inmobiliaria" required>
              <Input
                type="text"
                value={form.org_name}
                onChange={e => update('org_name', e.target.value)}
                required
                placeholder="Ej: Genta Inmobiliaria"
              />
            </Field>
            <Field label="Identificador único (URL)" hint="Se usa en links públicos">
              <div className="relative">
                <Input
                  type="text"
                  value={form.org_slug}
                  onChange={e => update('org_slug', e.target.value)}
                  required
                  placeholder="genta-inmobiliaria"
                  className="pr-8"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {slugStatus === 'checking' && <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />}
                  {slugStatus === 'available' && <CheckCircle className="w-4 h-4 text-green-500" />}
                  {slugStatus === 'taken' && <XCircle className="w-4 h-4 text-red-500" />}
                </div>
              </div>
              {slugStatus === 'available' && <Text size="xs" tone="success" className="mt-1">Disponible</Text>}
              {slugStatus === 'taken' && <Text size="xs" tone="danger" className="mt-1">Ya está en uso, elegí otro</Text>}
            </Field>
            <Button
              type="submit"
              size="lg"
              fullWidth
              disabled={slugStatus === 'taken' || slugStatus === 'checking' || !form.org_name}
            >
              Continuar <ChevronRight className="w-4 h-4" />
            </Button>
          </form>
        )}

        {/* STEP 2 */}
        {step === 2 && (
          <form onSubmit={handleStep2Submit} className="space-y-4">
            <Field label="Tu nombre completo" required>
              <Input
                type="text"
                value={form.admin_name}
                onChange={e => update('admin_name', e.target.value)}
                required
                placeholder="Marcela Genta"
              />
            </Field>
            <Field label="Email" required>
              <Input
                type="email"
                value={form.email}
                onChange={e => update('email', e.target.value)}
                required
                placeholder="marcela@genta.com"
              />
            </Field>
            <Field label="Contraseña" required>
              <Input
                type="password"
                value={form.password}
                onChange={e => update('password', e.target.value)}
                required
                minLength={8}
                placeholder="Mínimo 8 caracteres"
              />
            </Field>
            <div className="flex gap-3">
              <Button
                variant="outline"
                size="lg"
                className="flex-1"
                onClick={() => { setStep(1); setError('') }}
              >
                Atrás
              </Button>
              <Button type="submit" size="lg" className="flex-1" loading={loading}>
                {loading ? 'Creando…' : 'Crear cuenta'}
              </Button>
            </div>
          </form>
        )}

        {/* STEP 3 — Optional personalization */}
        {step === 3 && (
          <form onSubmit={handleStep3Save} className="space-y-4">
            <Text size="sm" tone="muted" className="-mt-2 mb-2">
              Podés configurar esto ahora o después desde <strong>Configuración</strong>.
            </Text>
            <Field label="URL del logo">
              <Input
                type="url"
                value={form.logo_url}
                onChange={e => update('logo_url', e.target.value)}
                placeholder="https://tuinmobiliaria.com/logo.png"
              />
            </Field>
            <Field label="Color de marca">
              <div className="flex items-center gap-3">
                <Input
                  type="color"
                  value={form.brand_color}
                  onChange={e => update('brand_color', e.target.value)}
                  className="h-10 w-16 cursor-pointer p-1 px-1"
                />
                <Text size="sm" tone="muted" className="font-mono">{form.brand_color}</Text>
              </div>
            </Field>
            <Button type="submit" size="lg" fullWidth loading={loading}>
              Guardar y entrar
            </Button>
            <Button
              variant="ghost"
              fullWidth
              onClick={() => { router.push('/dashboard'); router.refresh() }}
            >
              Saltar por ahora
            </Button>
          </form>
        )}

        {step < 3 && (
          <Text size="sm" tone="muted" className="text-center mt-6">
            ¿Ya tenés cuenta?{' '}
            <Link href="/login" className="text-primary hover:underline font-medium">
              Ingresá acá
            </Link>
          </Text>
        )}
      </div>
    </div>
  )
}
