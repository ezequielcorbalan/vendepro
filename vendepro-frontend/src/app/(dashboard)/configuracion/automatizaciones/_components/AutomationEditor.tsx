'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Loader2, Save, Zap, Filter, ListChecks } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import type { AutomationsMeta, AutomationListItem, DedupeScope } from '@/lib/automations'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input, Select, Field } from '@/components/ui/Input'
import { Alert } from '@/components/ui/Alert'
import { Heading, Text } from '@/components/ui/Typography'
import { useToast } from '@/components/ui/Toast'
import { ConfigFields, type FieldContext } from './ConfigFields'
import { ConditionsEditor } from './ConditionsEditor'
import { ActionsEditor, type DraftAction } from './ActionsEditor'
import { GenerateSequence } from './GenerateSequence'
import type { AutomationCondition } from '@/lib/automations'

interface AutomationEditorProps {
  /** undefined = alta. */
  automationId?: string
}

export function AutomationEditor({ automationId }: AutomationEditorProps) {
  const router = useRouter()
  const { toast } = useToast()

  const [meta, setMeta] = useState<AutomationsMeta | null>(null)
  const [users, setUsers] = useState<Array<{ id: string; full_name: string }>>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [saving, setSaving] = useState(false)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [triggerType, setTriggerType] = useState('')
  const [triggerConfig, setTriggerConfig] = useState<Record<string, unknown>>({})
  const [conditions, setConditions] = useState<AutomationCondition[]>([])
  const [dedupeScope, setDedupeScope] = useState<DedupeScope>('daily')
  const [actions, setActions] = useState<DraftAction[]>([])
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    try {
      const requests: Promise<Response>[] = [
        apiFetch('crm', '/automations/meta'),
        // Los agentes viven en api-admin, no en api-crm.
        apiFetch('admin', '/agents'),
      ]
      if (automationId) requests.push(apiFetch('crm', `/automations/${automationId}`))

      const [metaRes, usersRes, itemRes] = await Promise.all(requests)
      const m = (await metaRes.json()) as AutomationsMeta
      setMeta(m)

      const userList = (await usersRes.json()) as any
      setUsers(Array.isArray(userList)
        ? userList.map((u: any) => ({ id: u.id, full_name: u.full_name ?? u.name ?? u.email }))
        : [])

      if (itemRes) {
        const item = (await itemRes.json()) as AutomationListItem
        setName(item.automation.name)
        setDescription(item.automation.description ?? '')
        setTriggerType(item.automation.trigger_type)
        setTriggerConfig(item.automation.trigger_config ?? {})
        setConditions(item.automation.conditions ?? [])
        setDedupeScope(item.automation.dedupe_scope ?? 'daily')
        setActions((item.actions ?? []).map((a, i) => ({
          key: a.id ?? `saved-${i}`,
          id: a.id,
          action_type: a.action_type,
          action_config: a.action_config ?? {},
          delay_minutes: a.delay_minutes ?? 0,
        })))
      } else {
        setTriggerType(m.triggers[0]?.key ?? '')
      }
      setLoadError(false)
    } catch {
      setLoadError(true)
    }
    setLoading(false)
  }, [automationId])

  useEffect(() => { load() }, [load])

  const trigger = useMemo(
    () => meta?.triggers.find(t => t.key === triggerType) ?? null,
    [meta, triggerType],
  )

  // Sólo las acciones que tienen sentido para la entidad del disparador: no se
  // puede "asignar el lead" desde un evento de propiedad, y el backend lo
  // rechaza, así que ni se ofrece.
  const availableActions = useMemo(() => {
    if (!meta || !trigger) return []
    return meta.actions.filter(a => trigger.actions.includes(a.key))
  }, [meta, trigger])

  const fieldCtx: FieldContext = useMemo(() => ({
    meta: meta!,
    stages: trigger?.entity_type === 'property'
      ? (meta?.stages.property ?? [])
      : (meta?.stages.lead ?? []),
    users,
    variables: trigger?.variables ?? [],
  }), [meta, trigger, users])

  const changeTrigger = (key: string) => {
    setTriggerType(key)
    // Cambiar de disparador invalida su config y las condiciones, que apuntan
    // a variables que quizá ya no existen.
    setTriggerConfig({})
    setConditions([])
    const nextTrigger = meta?.triggers.find(t => t.key === key)
    if (nextTrigger) {
      setActions(prev => prev.filter(a => nextTrigger.actions.includes(a.action_type)))
    }
  }

  const validate = (): boolean => {
    const errors: Record<string, string> = {}
    if (name.trim().length < 2) errors.name = 'Poné un nombre para reconocerla'
    if (!triggerType) errors.trigger = 'Elegí un disparador'
    if (actions.length === 0) errors.actions = 'Agregá al menos una acción'

    for (const field of trigger?.config_fields ?? []) {
      if (!field.required || field.type === 'stage') continue
      const value = triggerConfig[field.name]
      if (value === undefined || value === null || value === '') {
        errors[`trigger_${field.name}`] = `Completá "${field.label}"`
      }
    }

    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) {
      toast('Revisá los campos marcados', 'error')
      return false
    }
    return true
  }

  const save = async () => {
    if (!validate()) return
    setSaving(true)
    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        trigger_type: triggerType,
        trigger_config: triggerConfig,
        conditions,
        dedupe_scope: dedupeScope,
        actions: actions.map(a => ({
          id: a.id,
          action_type: a.action_type,
          action_config: a.action_config,
          delay_minutes: a.delay_minutes,
        })),
      }
      const res = await apiFetch(
        'crm',
        automationId ? `/automations/${automationId}` : '/automations',
        { method: automationId ? 'PUT' : 'POST', body: JSON.stringify(payload) },
      )
      const data = (await res.json()) as any
      if (data.error) { toast(data.error, 'error'); setSaving(false); return }

      // Las advertencias no bloquean el guardado (una variable de más renderiza
      // vacío), pero el cliente tiene que enterarse antes de encender la automatización.
      for (const warning of (data.warnings ?? []) as string[]) toast(warning, 'warning')
      toast(automationId ? 'Automatización guardada' : 'Automatización creada')
      router.push('/configuracion/automatizaciones')
    } catch {
      toast('No pudimos guardar', 'error')
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" aria-label="Cargando" />
      </div>
    )
  }

  if (loadError || !meta) {
    return (
      <div className="max-w-2xl mx-auto py-12">
        <Alert tone="danger" title="No pudimos cargar el editor">
          Revisá tu conexión y volvé a intentar.
          <div className="mt-3">
            <Button variant="outline" onClick={() => { setLoading(true); load() }}>Reintentar</Button>
          </div>
        </Alert>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <Link
        href="/configuracion/automatizaciones"
        className="inline-flex items-center text-sm gap-2 text-gray-700 hover:text-ink"
      >
        <ArrowLeft className="w-4 h-4" /> Volver a automatizaciones
      </Link>

      <PageHeader
        title={automationId ? 'Editar automatización' : 'Nueva automatización'}
        subtitle="Elegí cuándo se dispara, con qué condiciones y qué tiene que hacer"
        actions={
          <Button icon={<Save className="w-4 h-4" />} loading={saving} onClick={save}>
            Guardar
          </Button>
        }
      />

      <Card>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre" required error={fieldErrors.name}>
            <Input
              value={name}
              placeholder="Bienvenida al lead"
              onChange={e => setName(e.target.value)}
            />
          </Field>
          <Field label="Descripción" hint="Para que el equipo entienda qué hace">
            <Input
              value={description}
              placeholder="Email de acuse de recibo apenas entra un lead"
              onChange={e => setDescription(e.target.value)}
            />
          </Field>
        </div>
      </Card>

      {/* ── Paso 1: disparador ── */}
      <StepCard step={1} icon={<Zap className="w-4 h-4 text-gray-600" />} title="Cuándo se dispara">
        <Field label="Disparador" required error={fieldErrors.trigger}>
          <Select value={triggerType} onChange={e => changeTrigger(e.target.value)}>
            {meta.triggers.map(t => (
              <option key={t.key} value={t.key}>{t.label}</option>
            ))}
          </Select>
        </Field>

        {trigger && (
          <Text size="sm" tone="muted" className="mt-2">{trigger.description}</Text>
        )}

        {trigger && trigger.config_fields.length > 0 && (
          <div className="mt-4">
            <ConfigFields
              fields={trigger.config_fields}
              values={triggerConfig}
              onChange={(field, value) => setTriggerConfig(prev => ({ ...prev, [field]: value }))}
              ctx={fieldCtx}
              errors={Object.fromEntries(
                Object.entries(fieldErrors)
                  .filter(([k]) => k.startsWith('trigger_'))
                  .map(([k, v]) => [k.replace('trigger_', ''), v]),
              )}
            />
          </div>
        )}

        <div className="mt-4 pt-4 border-t border-gray-200">
          <Field
            label="Cada cuánto puede repetirse"
            hint={meta.dedupe_scopes.find(s => s.value === dedupeScope)?.help}
          >
            <Select value={dedupeScope} onChange={e => setDedupeScope(e.target.value as DedupeScope)}>
              {meta.dedupe_scopes.map(scope => (
                <option key={scope.value} value={scope.value}>{scope.label}</option>
              ))}
            </Select>
          </Field>
        </div>
      </StepCard>

      {/* ── Paso 2: condiciones ── */}
      <StepCard
        step={2}
        icon={<Filter className="w-4 h-4 text-gray-600" />}
        title="Con qué condiciones"
        subtitle="Opcional. Se tienen que cumplir todas para que la automatización corra."
      >
        <ConditionsEditor
          conditions={conditions}
          onChange={setConditions}
          meta={meta}
          variables={trigger?.variables ?? []}
        />
      </StepCard>

      {/* ── Paso 3: acciones ── */}
      <StepCard
        step={3}
        icon={<ListChecks className="w-4 h-4 text-gray-600" />}
        title="Qué tiene que hacer"
      >
        {fieldErrors.actions && (
          <Alert tone="danger" className="mb-3">{fieldErrors.actions}</Alert>
        )}

        {/* Sólo tiene sentido para secuencias de email; en un disparador que no
            admite `send_email` se oculta. */}
        {availableActions.some(a => a.key === 'send_email') && (
          <div className="mb-4">
            <GenerateSequence hasActions={actions.length > 0} onGenerated={setActions} />
          </div>
        )}

        <ActionsEditor
          actions={actions}
          onChange={setActions}
          available={availableActions}
          ctx={fieldCtx}
        />
      </StepCard>

      <div className="flex justify-end gap-2">
        <Link
          href="/configuracion/automatizaciones"
          className="inline-flex items-center text-sm px-4 py-2 gap-2 rounded-control text-gray-700 hover:bg-gray-100"
        >
          Cancelar
        </Link>
        <Button icon={<Save className="w-4 h-4" />} loading={saving} onClick={save}>
          Guardar
        </Button>
      </div>
    </div>
  )
}

function StepCard({
  step, icon, title, subtitle, children,
}: {
  step: number
  icon: React.ReactNode
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  return (
    <Card>
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="w-7 h-7 rounded-full bg-gray-100 text-gray-700 grid place-items-center text-sm font-semibold shrink-0"
        >
          {step}
        </span>
        <div className="min-w-0 flex-1">
          <Heading level={3} className="flex items-center gap-2">{icon} {title}</Heading>
          {subtitle && <Text size="sm" tone="muted" className="mt-0.5">{subtitle}</Text>}
          <div className="mt-4">{children}</div>
        </div>
      </div>
    </Card>
  )
}
