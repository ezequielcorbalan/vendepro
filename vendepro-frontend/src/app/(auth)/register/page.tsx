'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { CheckCircle, XCircle, Loader2, ChevronRight } from 'lucide-react'
import { apiFetch, setToken } from '@/lib/api'
import { setCurrentUser } from '@/lib/auth'
import { AuthCard } from '@/components/auth/AuthCard'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Input'
import { Stepper } from '@/components/ui/Stepper'
import { Text } from '@/components/ui/Typography'

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
    <AuthCard
      title="Registrá tu inmobiliaria"
      footer={
        step < 3 ? (
          <Text size="sm" tone="muted">
            ¿Ya tenés cuenta?{' '}
            <Link href="/login" className="text-primary hover:underline font-medium">
              Ingresá acá
            </Link>
          </Text>
        ) : undefined
      }
    >
      {/* ds-todo: el Stepper pills no distingue pasos deshabilitados, así que
          los de adelante quedan clickeables sin efecto (sólo se puede volver). */}
      <Stepper
        variant="pills"
        className="mb-6"
        label="Progreso del registro"
        current={step - 1}
        steps={STEPS.map(label => ({ label }))}
        onStepChange={i => { if (i < step - 1) { setStep((i + 1) as Step); setError('') } }}
      />

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
            <Field
              label="Identificador único (URL)"
              hint="Se usa en los links públicos"
              error={slugStatus === 'taken' ? 'Ya está en uso, elegí otro' : undefined}
              required
            >
              <div className="relative">
                <Input
                  type="text"
                  value={form.org_slug}
                  onChange={e => update('org_slug', e.target.value)}
                  required
                  placeholder="genta-inmobiliaria"
                  className="pr-9"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {slugStatus === 'checking' && <Loader2 className="w-4 h-4 text-gray-400 animate-spin" aria-hidden="true" />}
                  {slugStatus === 'available' && <CheckCircle className="w-4 h-4 text-success" aria-hidden="true" />}
                  {slugStatus === 'taken' && <XCircle className="w-4 h-4 text-danger" aria-hidden="true" />}
                </div>
              </div>
            </Field>
            {slugStatus === 'available' && <Text size="xs" className="text-success -mt-2">Disponible</Text>}
            <Button
              type="submit"
              disabled={slugStatus === 'taken' || slugStatus === 'checking' || !form.org_name}
              className="w-full justify-center"
            >
              Continuar <ChevronRight className="w-4 h-4" aria-hidden="true" />
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
                type="button"
                variant="outline"
                onClick={() => { setStep(1); setError('') }}
                className="flex-1 justify-center"
              >
                Atrás
              </Button>
              <Button type="submit" loading={loading} className="flex-1 justify-center">
                {loading ? 'Creando...' : 'Crear cuenta'}
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
                {/* El selector nativo de color no tiene equivalente en el DS. */}
                <input
                  type="color"
                  value={form.brand_color}
                  onChange={e => update('brand_color', e.target.value)}
                  className="h-10 w-16 rounded-control border border-gray-300 cursor-pointer p-1"
                  aria-label="Color de marca"
                />
                <Text size="sm" tone="muted" as="span" className="font-mono">{form.brand_color}</Text>
              </div>
            </Field>
            <Button type="submit" loading={loading} className="w-full justify-center">
              Guardar y entrar
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => { router.push('/dashboard'); router.refresh() }}
              className="w-full justify-center"
            >
              Saltar por ahora
            </Button>
          </form>
        )}

    </AuthCard>
  )
}
