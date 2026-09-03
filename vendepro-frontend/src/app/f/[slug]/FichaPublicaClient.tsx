'use client'

import { useMemo, useState } from 'react'
import { CheckCircle2, Home, Link2Off, ArrowLeft, ArrowRight, Send } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Field, Input, Textarea } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Heading, Text } from '@/components/ui/Typography'
import { PillRadioGroup, PillCheckGroup } from '@/components/ui/ChoicePills'
import { Alert } from '@/components/ui/Alert'
import { StepIndicator } from '@/components/ui/StepIndicator'
import {
  QUESTIONS,
  questionsFor,
  stepsFor,
  stepTitle,
  attr,
  type PropertyType,
  type Question,
} from '@/lib/ficha-publica'

interface Props {
  slug: string
  apiPublic: string
  data: {
    slug: string
    mode: 'single' | 'open'
    open: boolean
    prefill: {
      address?: string | null
      neighborhood?: string | null
      property_type?: string | null
      owner_name?: string | null
      owner_phone?: string | null
      owner_email?: string | null
    } | null
    org: { name: string; logo_url: string | null; brand_color: string | null }
    agent: { name: string; photo_url: string | null } | null
  }
}

/** Las tres superficies se suman y se muestran en vivo. */
const AREA_KEYS = ['covered_area', 'semi_area', 'uncovered_area']

function emptyAnswers(): Record<string, any> {
  const out: Record<string, any> = {}
  for (const q of QUESTIONS) out[q.key] = q.kind === 'multipills' ? [] : ''
  return out
}

export default function FichaPublicaClient({ slug, apiPublic, data }: Props) {
  const pre = data.prefill

  const [answers, setAnswers] = useState<Record<string, any>>(() => ({
    ...emptyAnswers(),
    property_type: (pre?.property_type as PropertyType) || 'departamento',
    operation: '',
    address: pre?.address ?? '',
    neighborhood: pre?.neighborhood ?? '',
  }))
  const [owner, setOwner] = useState({
    owner_name: pre?.owner_name ?? '',
    owner_phone: pre?.owner_phone ?? '',
    owner_email: pre?.owner_email ?? '',
    notes: '',
  })
  // Honeypot: invisible para personas, irresistible para bots.
  const [miel, setMiel] = useState('')
  const [consent, setConsent] = useState(false)

  const [stepIndex, setStepIndex] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const type = (answers.property_type || 'departamento') as PropertyType

  // Cambiar el tipo cambia qué pasos existen, así que se recalculan siempre.
  const steps = useMemo(() => stepsFor(type), [type])
  const currentStep = steps[Math.min(stepIndex, steps.length - 1)]
  const isLast = currentStep === 5

  const visible = useMemo(
    () => questionsFor(type, currentStep).filter(q => !q.showIf || q.showIf(answers)),
    [type, currentStep, answers],
  )

  const totalArea = useMemo(() => {
    const n = AREA_KEYS.reduce((acc, k) => acc + (parseFloat(answers[k]) || 0), 0)
    return n > 0 ? n : null
  }, [answers])

  function set(key: string, value: any) {
    setAnswers(a => ({ ...a, [key]: value }))
  }

  /** Multivalor con opción excluyente ("Ninguno" limpia el resto y viceversa). */
  function setMulti(q: Question, next: string[]) {
    const none = attr(q.exclusive, type)
    const current: string[] = answers[q.key] ?? []
    const added = next.find(v => !current.includes(v))
    if (none && added === none) return set(q.key, [none])
    set(q.key, none ? next.filter(v => v !== none) : next)
  }

  function validate(step: number): string | null {
    if (step === 5) {
      if (!owner.owner_name.trim()) return 'Necesitamos tu nombre y apellido.'
      if (!owner.owner_phone.trim()) return 'Necesitamos un teléfono para contactarte.'
      if (!consent) return 'Necesitamos tu conformidad para poder contactarte.'
      return null
    }
    for (const q of questionsFor(type, step)) {
      if (!attr(q.required, type)) continue
      if (q.showIf && !q.showIf(answers)) continue
      const v = answers[q.key]
      const empty = Array.isArray(v) ? v.length === 0 : !String(v ?? '').trim()
      if (empty) return q.missing ?? 'Falta completar un campo.'
    }
    return null
  }

  function go(delta: number) {
    if (delta > 0) {
      const problem = validate(currentStep)
      if (problem) return setError(problem)
    }
    setError(null)
    setStepIndex(i => Math.max(0, Math.min(steps.length - 1, i + delta)))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const problem = validate(5)
    if (problem) return setError(problem)

    setError(null)
    setSubmitting(true)
    try {
      // Sólo se manda lo que se preguntó: si el tipo cambió a mitad de camino,
      // las respuestas viejas de preguntas ya no visibles no deben viajar.
      const payload: Record<string, any> = {}
      for (const q of QUESTIONS) {
        if (!q.appliesTo.includes(type)) continue
        if (q.showIf && !q.showIf(answers)) continue
        payload[q.key] = answers[q.key]
      }
      const res = await fetch(`${apiPublic}/public/ficha/${slug}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          ...owner,
          owner_email: owner.owner_email.trim() || null,
          miel,
        }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as any
        throw new Error(body?.error || 'No pudimos enviar la ficha. Probá de nuevo.')
      }
      setDone(true)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (e: any) {
      setError(e?.message || 'No pudimos enviar la ficha. Probá de nuevo.')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Link cerrado (archivado o ya usado) ───────────────────────
  if (!data.open && !done) {
    return (
      <Shell org={data.org}>
        <Card className="text-center">
          <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <Link2Off className="w-7 h-7 text-gray-400" />
          </div>
          <Heading level={2}>Este formulario ya no está disponible</Heading>
          <Text tone="muted" className="mt-2">
            Puede que ya lo hayas completado o que el link haya vencido. Si necesitás
            cargar los datos de nuevo, escribinos y te mandamos uno nuevo.
          </Text>
        </Card>
      </Shell>
    )
  }

  // ── Enviado ───────────────────────────────────────────────────
  if (done) {
    return (
      <Shell org={data.org}>
        <Card className="text-center">
          <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-9 h-9 text-success" />
          </div>
          <Heading level={2}>¡Listo, gracias!</Heading>
          <Text tone="muted" className="mt-2">
            Ya recibimos los datos de tu propiedad.
            {data.agent
              ? ` ${data.agent.name} se va a contactar con vos para coordinar la visita de tasación.`
              : ' Nos vamos a contactar con vos para coordinar la visita de tasación.'}
          </Text>
          {answers.address && (
            <div className="mt-6 p-4 rounded-card bg-gray-50 border border-gray-100 text-left">
              <div className="flex items-center gap-2 mb-1">
                <Home className="w-4 h-4 text-gray-500" />
                <Text size="xs" tone="muted">Propiedad</Text>
              </div>
              <Text weight="medium">{answers.address}</Text>
              {answers.neighborhood && <Text size="xs" tone="muted">{answers.neighborhood}</Text>}
            </div>
          )}
        </Card>
      </Shell>
    )
  }

  return (
    <Shell org={data.org} agent={data.agent}>
      <Card>
        <div className="flex items-center justify-between gap-3 mb-1">
          <Heading level={3}>{stepTitle(currentStep, type)}</Heading>
          <StepIndicator variant="dots" steps={steps.length} current={stepIndex + 1} />
        </div>
        <Text size="xs" tone="muted">
          Todo lo que completes ahora nos ahorra tiempo el día de la tasación.
        </Text>
      </Card>

      <form onSubmit={handleSubmit} className="space-y-5">
        <input
          type="text"
          name="miel"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          value={miel}
          onChange={e => setMiel(e.target.value)}
          className="absolute -left-[9999px] w-px h-px opacity-0"
        />

        {!isLast && (
          <Card className="space-y-4">
            {visible.map(q => (
              <QuestionField
                key={q.key}
                q={q}
                type={type}
                value={answers[q.key]}
                onChange={v => (q.kind === 'multipills' ? setMulti(q, v) : set(q.key, v))}
              />
            ))}
            {/* El total se calcula solo: el propietario carga las partes. */}
            {totalArea !== null && visible.some(q => AREA_KEYS.includes(q.key)) && (
              <div className="pt-1 border-t border-gray-100">
                <Text size="xs" tone="muted">
                  Superficie total declarada: <strong>{totalArea} m²</strong>
                </Text>
              </div>
            )}
          </Card>
        )}

        {isLast && (
          <Card className="space-y-4">
            <Field label="Nombre y apellido" required>
              <Input
                value={owner.owner_name}
                onChange={e => setOwner(o => ({ ...o, owner_name: e.target.value }))}
                placeholder="Juan Pérez"
              />
            </Field>
            <Field label="Teléfono / WhatsApp" required>
              <Input
                type="tel"
                inputMode="tel"
                value={owner.owner_phone}
                onChange={e => setOwner(o => ({ ...o, owner_phone: e.target.value }))}
                placeholder="11 5555 5555"
              />
            </Field>
            <Field label="Email">
              <Input
                type="email"
                value={owner.owner_email}
                onChange={e => setOwner(o => ({ ...o, owner_email: e.target.value }))}
                placeholder="juan@mail.com"
              />
            </Field>
            <Field label="Observaciones" hint="Cualquier cosa que nos sirva saber">
              <Textarea
                rows={3}
                value={owner.notes}
                onChange={e => setOwner(o => ({ ...o, notes: e.target.value }))}
                placeholder="Se pintó todo en marzo. Quedan los placards."
              />
            </Field>

            {/* Ley 25.326 — consentimiento explícito antes de enviar datos personales. */}
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={consent}
                onChange={e => setConsent(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
              />
              <Text size="xs" tone="muted">
                Autorizo a {data.org.name} a usar estos datos para tasar mi propiedad y
                contactarme. Puedo pedir su baja cuando quiera.
              </Text>
            </label>
          </Card>
        )}

        {error && <Alert tone="danger">{error}</Alert>}

        <div className="flex items-center gap-3">
          {stepIndex > 0 && (
            <Button variant="outline" onClick={() => go(-1)} icon={<ArrowLeft className="w-4 h-4" />}>
              Atrás
            </Button>
          )}
          {!isLast ? (
            <Button onClick={() => go(1)} fullWidth icon={<ArrowRight className="w-4 h-4" />}>
              Siguiente
            </Button>
          ) : (
            <Button
              type="submit"
              fullWidth
              loading={submitting}
              icon={<Send className="w-4 h-4" />}
            >
              Enviar ficha
            </Button>
          )}
        </div>
      </form>
    </Shell>
  )
}

/** Renderiza una pregunta del catálogo según su `kind`. */
function QuestionField({
  q,
  type,
  value,
  onChange,
}: {
  q: Question
  type: PropertyType
  value: any
  onChange: (v: any) => void
}) {
  const label = attr(q.label, type) ?? ''
  const hint = attr(q.hint, type)
  const placeholder = attr(q.placeholder, type)
  const options = attr(q.options, type) ?? []
  const required = attr(q.required, type) ?? false

  if (q.kind === 'pills') {
    return (
      <PillRadioGroup
        label={required ? `${label} *` : label}
        hint={hint}
        options={options}
        value={value ?? ''}
        onChange={onChange}
      />
    )
  }

  if (q.kind === 'multipills') {
    return (
      <PillCheckGroup
        label={required ? `${label} *` : label}
        hint={hint}
        options={options}
        value={value ?? []}
        onChange={onChange}
      />
    )
  }

  if (q.kind === 'textarea') {
    return (
      <Field label={label} hint={hint} required={required}>
        <Textarea rows={3} value={value ?? ''} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
      </Field>
    )
  }

  return (
    <Field label={label} hint={hint} required={required}>
      <Input
        type={q.kind === 'number' ? 'number' : 'text'}
        inputMode={q.kind === 'number' ? 'numeric' : undefined}
        value={value ?? ''}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </Field>
  )
}

/** Marco compartido: logo de la inmobiliaria arriba, contenido centrado. */
function Shell({
  org,
  agent,
  children,
}: {
  org: { name: string; logo_url: string | null }
  agent?: { name: string; photo_url: string | null } | null
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#fff0f6] to-white py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-5">
        <div className="flex items-start gap-3">
          {org.logo_url ? (
            <img src={org.logo_url} alt={org.name} className="h-10 w-auto object-contain" />
          ) : (
            <Heading level={3} className="flex-1 min-w-0">{org.name}</Heading>
          )}
          {agent && (
            <div className="text-right shrink-0">
              <Text size="xs" tone="muted">Te atiende</Text>
              <Text size="xs" weight="medium">{agent.name}</Text>
            </div>
          )}
        </div>
        <div className="space-y-5">{children}</div>
      </div>
    </div>
  )
}
