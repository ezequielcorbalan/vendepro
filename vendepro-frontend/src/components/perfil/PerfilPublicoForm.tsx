'use client'

import { useCallback, useEffect, useState } from 'react'
import { Globe, Copy, Check, Loader2, Save, Plus, Trash2 } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { Button } from '@/components/ui/Button'
import { Field, Input, Textarea } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import { Heading, Text } from '@/components/ui/Typography'
import { Alert } from '@/components/ui/Alert'
import { Switch } from '@/components/ui/Switch'
import { Tag } from '@/components/ui/Tag'

const MAX_ZONES = 12
const MAX_SPECIALTIES = 8
const MAX_STATS = 4
// Mismo patrón que valida el backend (AgentSlug): minúsculas/números, guiones
// simples entre medio, sin guiones al borde.
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

interface AgentStat {
  label: string
  value: string
}

interface AgentProfileForm {
  slug: string
  headline: string
  bio: string
  license: string
  years_experience: string
  zones: string[]
  specialties: string[]
  whatsapp: string
  instagram: string
  tiktok: string
  youtube: string
  linkedin: string
  website: string
  cover_image_url: string
  stats: AgentStat[]
  is_public: boolean
}

const EMPTY_FORM: AgentProfileForm = {
  slug: '',
  headline: '',
  bio: '',
  license: '',
  years_experience: '',
  zones: [],
  specialties: [],
  whatsapp: '',
  instagram: '',
  tiktok: '',
  youtube: '',
  linkedin: '',
  website: '',
  cover_image_url: '',
  stats: [],
  is_public: false,
}

function toForm(profile: any): AgentProfileForm {
  return {
    slug: profile?.slug ?? '',
    headline: profile?.headline ?? '',
    bio: profile?.bio ?? '',
    license: profile?.license ?? '',
    years_experience: profile?.years_experience != null ? String(profile.years_experience) : '',
    zones: Array.isArray(profile?.zones) ? profile.zones : [],
    specialties: Array.isArray(profile?.specialties) ? profile.specialties : [],
    whatsapp: profile?.whatsapp ?? '',
    instagram: profile?.instagram ?? '',
    tiktok: profile?.tiktok ?? '',
    youtube: profile?.youtube ?? '',
    linkedin: profile?.linkedin ?? '',
    website: profile?.website ?? '',
    cover_image_url: profile?.cover_image_url ?? '',
    stats: Array.isArray(profile?.stats) ? profile.stats : [],
    is_public: !!profile?.is_public,
  }
}

/** Chips editables (agregar con Enter/botón, quitar con la "x" del Tag). */
function ChipListEditor({
  label,
  values,
  onChange,
  max,
  placeholder,
}: {
  label: string
  values: string[]
  onChange: (values: string[]) => void
  max: number
  placeholder: string
}) {
  const [draft, setDraft] = useState('')
  const atLimit = values.length >= max

  const add = () => {
    const v = draft.trim()
    if (!v || atLimit || values.includes(v)) { setDraft(''); return }
    onChange([...values, v])
    setDraft('')
  }

  return (
    <Field label={`${label} (${values.length}/${max})`}>
      {values.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {values.map((v, i) => (
            <Tag key={`${v}-${i}`} onRemove={() => onChange(values.filter((_, idx) => idx !== i))}>
              {v}
            </Tag>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') { e.preventDefault(); add() }
          }}
          placeholder={atLimit ? `Máximo ${max}` : placeholder}
          disabled={atLimit}
        />
        <Button type="button" variant="outline" onClick={add} disabled={!draft.trim() || atLimit} icon={<Plus className="w-4 h-4" />}>
          Agregar
        </Button>
      </div>
    </Field>
  )
}

/** Hasta 4 pares label/value — los números de prueba social del agente. */
function StatsEditor({
  stats,
  onChange,
  max,
}: {
  stats: AgentStat[]
  onChange: (stats: AgentStat[]) => void
  max: number
}) {
  const update = (i: number, patch: Partial<AgentStat>) => {
    onChange(stats.map((s, idx) => (idx === i ? { ...s, ...patch } : s)))
  }
  const remove = (i: number) => onChange(stats.filter((_, idx) => idx !== i))
  const add = () => { if (stats.length < max) onChange([...stats, { label: '', value: '' }]) }

  return (
    <Field label={`Estadísticas (${stats.length}/${max})`} hint='Prueba social, ej: "Seguidores TikTok" / "170.000".'>
      {stats.length > 0 && (
        <div className="space-y-2 mb-2">
          {stats.map((s, i) => (
            <div key={i} className="flex flex-col sm:flex-row gap-2 sm:items-center">
              <Input
                value={s.label}
                onChange={e => update(i, { label: e.target.value })}
                placeholder="Etiqueta (ej: Seguidores TikTok)"
                className="flex-1"
                aria-label={`Etiqueta del stat ${i + 1}`}
              />
              <div className="flex gap-2">
                <Input
                  value={s.value}
                  onChange={e => update(i, { value: e.target.value })}
                  placeholder="Valor (ej: 170.000)"
                  className="flex-1 sm:w-32 sm:flex-none"
                  aria-label={`Valor del stat ${i + 1}`}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Quitar estadística"
                  onClick={() => remove(i)}
                >
                  <Trash2 className="w-4 h-4 text-gray-500" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
      {stats.length < max && (
        <Button type="button" variant="outline" onClick={add} icon={<Plus className="w-4 h-4" />}>
          Agregar estadística
        </Button>
      )}
    </Field>
  )
}

export function PerfilPublicoForm() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [orgSlug, setOrgSlug] = useState('')
  const [form, setForm] = useState<AgentProfileForm>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [slugError, setSlugError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    setLoadError(false)
    Promise.all([
      apiFetch('admin', '/profile/public').then(r => r.json() as Promise<any>),
      // /org-settings no está restringido por rol en el backend — cualquier
      // usuario autenticado puede leer el slug de su propia inmobiliaria.
      apiFetch('admin', '/org-settings').then(r => r.json() as Promise<any>),
    ])
      .then(([profile, org]) => {
        setForm(toForm(profile))
        setOrgSlug(org?.slug ?? '')
      })
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const publicPath = orgSlug && form.slug ? `/a/${orgSlug}/${form.slug}` : null
  const publicUrl = publicPath && typeof window !== 'undefined' ? `${window.location.origin}${publicPath}` : publicPath

  const copyUrl = async () => {
    if (!publicUrl) return
    try {
      await navigator.clipboard.writeText(publicUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast('No se pudo copiar', 'error')
    }
  }

  const handleSave = async () => {
    setSlugError(null)
    const slug = form.slug.trim().toLowerCase()
    if (slug.length < 3 || slug.length > 60 || !SLUG_RE.test(slug)) {
      setSlugError('Debe tener 3–60 caracteres: solo minúsculas, números y guiones simples entre medio.')
      return
    }

    let years: number | null = null
    if (form.years_experience.trim() !== '') {
      const n = Number(form.years_experience)
      if (!Number.isInteger(n) || n < 0 || n > 70) {
        toast('Años de experiencia inválido: debe ser un entero entre 0 y 70', 'error')
        return
      }
      years = n
    }

    setSaving(true)
    try {
      const res = await apiFetch('admin', '/profile/public', {
        method: 'PUT',
        body: JSON.stringify({
          slug,
          headline: form.headline.trim() || null,
          bio: form.bio.trim() || null,
          license: form.license.trim() || null,
          years_experience: years,
          zones: form.zones,
          specialties: form.specialties,
          whatsapp: form.whatsapp.trim() || null,
          instagram: form.instagram.trim() || null,
          tiktok: form.tiktok.trim() || null,
          youtube: form.youtube.trim() || null,
          linkedin: form.linkedin.trim() || null,
          website: form.website.trim() || null,
          cover_image_url: form.cover_image_url.trim() || null,
          stats: form.stats.filter(s => s.label.trim() && s.value.trim()),
          is_public: form.is_public,
        }),
      })
      const data = (await res.json()) as any
      if (!res.ok) {
        const msg = data?.error || 'No se pudo guardar el perfil'
        if (/slug/i.test(msg)) setSlugError(msg)
        else toast(msg, 'error')
        return
      }
      setForm(toForm(data))
      toast('Perfil público actualizado')
    } catch {
      toast('No se pudo guardar el perfil', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card padded={false} className="p-6">
      <div className="flex items-center gap-2 mb-1">
        <Globe className="w-4 h-4 text-gray-600" />
        <Heading level={2} as="h2">Perfil público</Heading>
      </div>
      <Text size="sm" tone="muted" className="mb-4">
        Así te van a ver quienes visiten tu landing. Esta info reemplaza los placeholders de la plantilla &quot;Perfil de agente&quot;.
      </Text>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : loadError ? (
        <Alert tone="danger" title="No se pudo cargar tu perfil público">
          <div className="flex items-center justify-between gap-3">
            <span>Probá de nuevo en un momento.</span>
            <Button variant="outline" size="sm" onClick={load}>Reintentar</Button>
          </div>
        </Alert>
      ) : (
        <div className="space-y-5">
          {/* URL pública — el link para la bio de Instagram */}
          <div>
            <Text size="xs" tone="muted" className="mb-1.5">
              Tu link público — pegalo en la bio de Instagram o donde te encuentren.
            </Text>
            <div className="flex flex-wrap items-center gap-2 p-3 rounded-control border border-gray-200 bg-gray-50">
              <Globe className="w-4 h-4 text-gray-400 shrink-0" aria-hidden />
              <Text size="xs" className="font-mono truncate flex-1 min-w-0">
                {publicUrl ?? 'Completá y guardá el slug para obtener tu link'}
              </Text>
              <Button
                variant="ghost"
                size="sm"
                onClick={copyUrl}
                disabled={!publicUrl}
                icon={copied ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
              >
                {copied ? 'Copiado' : 'Copiar'}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Field
              label="Slug (URL)"
              htmlFor="agent-slug"
              required
              error={slugError ?? undefined}
              hint={slugError ? undefined : 'Minúsculas, números y guiones. 3–60 caracteres.'}
            >
              <Input
                id="agent-slug"
                value={form.slug}
                onChange={e => {
                  setForm(f => ({ ...f, slug: e.target.value }))
                  if (slugError) setSlugError(null)
                }}
                placeholder="tu-nombre"
              />
            </Field>
            <Alert tone="warning">
              Si cambiás el slug, los links que ya repartiste dejan de funcionar.
            </Alert>
          </div>

          <div className="p-3 rounded-control border border-gray-200">
            <Switch
              checked={form.is_public}
              onChange={v => setForm(f => ({ ...f, is_public: v }))}
              label="Perfil público visible"
            />
            <Text size="xs" tone="muted" className="mt-1">
              Los cambios pueden tardar hasta un minuto en verse en la página pública.
            </Text>
          </div>

          <Field label="Headline" htmlFor="agent-headline" hint="Una frase corta que resuma tu propuesta.">
            <Input
              id="agent-headline"
              value={form.headline}
              onChange={e => setForm(f => ({ ...f, headline: e.target.value }))}
              maxLength={160}
            />
          </Field>

          <Field label="Bio" htmlFor="agent-bio">
            <Textarea
              id="agent-bio"
              value={form.bio}
              onChange={e => setForm(f => ({ ...f, bio: e.target.value }))}
              maxLength={1200}
              rows={4}
            />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Matrícula" htmlFor="agent-license">
              <Input
                id="agent-license"
                value={form.license}
                onChange={e => setForm(f => ({ ...f, license: e.target.value }))}
              />
            </Field>
            <Field label="Años de experiencia" htmlFor="agent-years">
              <Input
                id="agent-years"
                type="number"
                min={0}
                max={70}
                value={form.years_experience}
                onChange={e => setForm(f => ({ ...f, years_experience: e.target.value }))}
              />
            </Field>
          </div>

          <ChipListEditor
            label="Zonas"
            values={form.zones}
            onChange={zones => setForm(f => ({ ...f, zones }))}
            max={MAX_ZONES}
            placeholder="Ej: Palermo"
          />

          <ChipListEditor
            label="Especialidades"
            values={form.specialties}
            onChange={specialties => setForm(f => ({ ...f, specialties }))}
            max={MAX_SPECIALTIES}
            placeholder="Ej: Departamentos a estrenar"
          />

          <div>
            <Heading level={3} className="mb-3">Redes y contacto</Heading>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="WhatsApp" htmlFor="agent-whatsapp" hint="Con código de país, sin espacios (ej: 5491155551234).">
                <Input
                  id="agent-whatsapp"
                  value={form.whatsapp}
                  onChange={e => setForm(f => ({ ...f, whatsapp: e.target.value }))}
                />
              </Field>
              <Field label="Instagram" htmlFor="agent-instagram">
                <Input
                  id="agent-instagram"
                  value={form.instagram}
                  onChange={e => setForm(f => ({ ...f, instagram: e.target.value }))}
                  placeholder="@tu_usuario"
                />
              </Field>
              <Field label="TikTok" htmlFor="agent-tiktok">
                <Input
                  id="agent-tiktok"
                  value={form.tiktok}
                  onChange={e => setForm(f => ({ ...f, tiktok: e.target.value }))}
                  placeholder="@tu_usuario"
                />
              </Field>
              <Field label="YouTube" htmlFor="agent-youtube">
                <Input
                  id="agent-youtube"
                  value={form.youtube}
                  onChange={e => setForm(f => ({ ...f, youtube: e.target.value }))}
                  placeholder="https://youtube.com/@tu-canal"
                />
              </Field>
              <Field label="LinkedIn" htmlFor="agent-linkedin">
                <Input
                  id="agent-linkedin"
                  value={form.linkedin}
                  onChange={e => setForm(f => ({ ...f, linkedin: e.target.value }))}
                  placeholder="https://linkedin.com/in/tu-usuario"
                />
              </Field>
              <Field label="Sitio web" htmlFor="agent-website">
                <Input
                  id="agent-website"
                  value={form.website}
                  onChange={e => setForm(f => ({ ...f, website: e.target.value }))}
                  placeholder="https://..."
                />
              </Field>
            </div>
          </div>

          <Field label="Imagen de portada (URL)" htmlFor="agent-cover" hint="Se usa como fondo del hero en tu landing.">
            <Input
              id="agent-cover"
              value={form.cover_image_url}
              onChange={e => setForm(f => ({ ...f, cover_image_url: e.target.value }))}
              placeholder="https://..."
            />
          </Field>

          <StatsEditor
            stats={form.stats}
            onChange={stats => setForm(f => ({ ...f, stats }))}
            max={MAX_STATS}
          />

          <Button onClick={handleSave} loading={saving} icon={<Save className="w-4 h-4" />}>
            Guardar cambios
          </Button>
        </div>
      )}
    </Card>
  )
}
