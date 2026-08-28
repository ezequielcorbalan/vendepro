'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  Zap, Plus, Loader2, Sparkles, Check, History, Pencil, Trash2, ChevronRight,
} from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { getCurrentUser } from '@/lib/auth'
import {
  type AutomationListItem, type CatalogItem, type AutomationsMeta, type AutomationRun,
  AUTOMATION_STATE, CATALOG_ACTIVATED, NEUTRAL_CHIP,
  runStatusConfig, runActionStatusConfig, skipReasonLabel,
  delayLabel, fmtDateTime, summarize,
} from '@/lib/automations'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Tabs } from '@/components/ui/Tabs'
import { Switch } from '@/components/ui/Switch'
import { Alert } from '@/components/ui/Alert'
import { EmptyState } from '@/components/ui/EmptyState'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { StatTile } from '@/components/ui/StatTile'
import { Heading, Text } from '@/components/ui/Typography'
import { useToast } from '@/components/ui/Toast'
import { useConfirm } from '@/components/ui/useConfirm'

type TabValue = 'activas' | 'recetas' | 'historial'

export default function AutomatizacionesPage() {
  const profile = getCurrentUser()
  const isAdmin = profile?.role === 'admin' || profile?.role === 'owner'
  const { toast } = useToast()
  const { confirmDialog, askConfirm } = useConfirm()

  const [tab, setTab] = useState<TabValue>('activas')
  const [items, setItems] = useState<AutomationListItem[]>([])
  const [catalog, setCatalog] = useState<CatalogItem[]>([])
  const [meta, setMeta] = useState<AutomationsMeta | null>(null)
  const [runs, setRuns] = useState<AutomationRun[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const [listRes, catRes, metaRes] = await Promise.all([
        apiFetch('crm', '/automations'),
        apiFetch('crm', '/automations/catalog'),
        apiFetch('crm', '/automations/meta'),
      ])
      const list = (await listRes.json()) as any
      const cat = (await catRes.json()) as any
      const m = (await metaRes.json()) as any
      setItems(Array.isArray(list) ? list : [])
      setCatalog(Array.isArray(cat) ? cat : [])
      setMeta(m)
      setError(false)
    } catch {
      setError(true)
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // El historial se carga recién al abrir su pestaña: es la consulta más cara
  // y la mayoría de las visitas van a la lista o a la galería.
  useEffect(() => {
    if (tab !== 'historial' || runs.length > 0) return
    apiFetch('crm', '/automations/runs?limit=50')
      .then(r => r.json() as Promise<any>)
      .then(d => setRuns(Array.isArray(d) ? d : []))
      .catch(() => toast('No pudimos cargar el historial', 'error'))
  }, [tab, runs.length, toast])

  const toggle = async (item: AutomationListItem, active: boolean) => {
    setBusy(item.automation.id)
    try {
      const res = await apiFetch('crm', `/automations/${item.automation.id}/status`, {
        method: 'POST',
        body: JSON.stringify({ active }),
      })
      const data = (await res.json()) as any
      if (data.error) { toast(data.error, 'error'); return }
      setItems(prev => prev.map(i =>
        i.automation.id === item.automation.id
          ? { ...i, automation: { ...i.automation, is_active: active } }
          : i,
      ))
      toast(active ? 'Automatización activada' : 'Automatización pausada')
    } catch {
      toast('No pudimos cambiar el estado', 'error')
    }
    setBusy(null)
  }

  const activate = async (recipe: CatalogItem) => {
    setBusy(recipe.template_key)
    try {
      const res = await apiFetch('crm', `/automations/catalog/${recipe.template_key}/activate`, {
        method: 'POST',
        body: JSON.stringify({ active: true }),
      })
      const data = (await res.json()) as any
      if (data.error) { toast(data.error, 'error'); setBusy(null); return }
      toast('Receta activada')
      setRuns([])
      await load()
      setTab('activas')
    } catch {
      toast('No pudimos activar la receta', 'error')
    }
    setBusy(null)
  }

  const remove = async (item: AutomationListItem) => {
    const { confirmed } = await askConfirm({
      title: 'Eliminar automatización',
      message: `Se elimina "${item.automation.name}" y se cancelan las acciones que tenga pendientes de enviar.

Esta acción no se puede deshacer.`,
      confirmLabel: 'Eliminar',
      variant: 'danger',
    })
    if (!confirmed) return

    setBusy(item.automation.id)
    try {
      await apiFetch('crm', `/automations/${item.automation.id}`, { method: 'DELETE' })
      setItems(prev => prev.filter(i => i.automation.id !== item.automation.id))
      toast('Automatización eliminada')
      await load()
    } catch {
      toast('No pudimos eliminarla', 'error')
    }
    setBusy(null)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" aria-label="Cargando" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto py-12">
        <Alert tone="danger" title="No pudimos cargar las automatizaciones">
          Revisá tu conexión y volvé a intentar.
          <div className="mt-3">
            <Button variant="outline" onClick={() => { setLoading(true); load() }}>Reintentar</Button>
          </div>
        </Alert>
      </div>
    )
  }

  const activeCount = items.filter(i => i.automation.is_active).length
  const runsTotal = items.reduce((sum, i) => sum + i.stats.total, 0)
  const failedTotal = items.reduce((sum, i) => sum + i.stats.failed, 0)
  const pending = catalog.filter(r => !r.activated).length

  return (
    <div className="space-y-6">
      <PageHeader
        title="Automatizaciones"
        subtitle="Cuando pasa algo en el CRM, la plataforma actúa sola"
        actions={isAdmin ? (
          <Link
            href="/configuracion/automatizaciones/nueva"
            className="inline-flex items-center text-sm px-4 py-2 gap-2 rounded-control bg-primary text-white font-medium hover:bg-primary-hover"
          >
            <Plus className="w-4 h-4" /> Nueva automatización
          </Link>
        ) : undefined}
      />

      {!isAdmin && (
        <Alert tone="info">
          Podés ver las automatizaciones de la inmobiliaria, pero sólo un administrador puede crearlas o modificarlas.
        </Alert>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile icon={<Zap className="w-5 h-5" />} tone="primary" label="Activas" value={activeCount} />
        <StatTile icon={<History className="w-5 h-5" />} tone="info" label="Ejecuciones" value={runsTotal} />
        <StatTile
          icon={<Sparkles className="w-5 h-5" />}
          tone="success"
          label="Recetas sin activar"
          value={pending}
        />
        <StatTile
          icon={<Zap className="w-5 h-5" />}
          tone={failedTotal > 0 ? 'danger' : 'info'}
          label="Con error"
          value={failedTotal}
        />
      </div>

      <Tabs
        value={tab}
        onChange={v => setTab(v as TabValue)}
        items={[
          { value: 'activas', label: 'Mis automatizaciones', count: items.length },
          { value: 'recetas', label: 'Recetas listas para usar', count: pending },
          { value: 'historial', label: 'Historial' },
        ]}
      />

      {tab === 'activas' && (
        <ActivasTab
          items={items}
          meta={meta}
          isAdmin={isAdmin}
          busy={busy}
          onToggle={toggle}
          onDelete={remove}
          onGoToCatalog={() => setTab('recetas')}
        />
      )}

      {tab === 'recetas' && (
        <RecetasTab catalog={catalog} isAdmin={isAdmin} busy={busy} onActivate={activate} />
      )}

      {tab === 'historial' && <HistorialTab runs={runs} items={items} meta={meta} />}

      {confirmDialog}
    </div>
  )
}

// ── Pestaña: mis automatizaciones ─────────────────────────────

function ActivasTab({
  items, meta, isAdmin, busy, onToggle, onDelete, onGoToCatalog,
}: {
  items: AutomationListItem[]
  meta: AutomationsMeta | null
  isAdmin: boolean
  busy: string | null
  onToggle: (item: AutomationListItem, active: boolean) => void
  onDelete: (item: AutomationListItem) => void
  onGoToCatalog: () => void
}) {
  if (items.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={<Zap className="w-6 h-6" />}
          title="Todavía no hay automatizaciones"
          description="Activá una receta lista para usar o armá la tuya desde cero. Podés empezar por el email de bienvenida a los leads nuevos."
          action={isAdmin ? <Button onClick={onGoToCatalog}>Ver recetas</Button> : undefined}
        />
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      {items.map(item => {
        const state = item.automation.is_active ? AUTOMATION_STATE.on : AUTOMATION_STATE.off
        const working = busy === item.automation.id
        return (
          <Card key={item.automation.id}>
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <Heading level={4}>{item.automation.name}</Heading>
                  <StatusBadge label={state.label} color={state.color} />
                </div>

                {item.automation.description && (
                  <Text size="sm" tone="muted" className="mt-1">{item.automation.description}</Text>
                )}

                {meta && (
                  <Text size="sm" tone="muted" className="mt-2">
                    {summarize(item, meta.triggers, meta.actions)}
                  </Text>
                )}

                <div className="flex items-center gap-x-4 gap-y-1 flex-wrap mt-2">
                  <Text size="xs" tone="muted">
                    {item.stats.total === 0
                      ? 'Todavía no se ejecutó'
                      : `${item.stats.total} ${item.stats.total === 1 ? 'ejecución' : 'ejecuciones'} · última ${fmtDateTime(item.stats.last_run_at)}`}
                  </Text>
                  {item.stats.failed > 0 && (
                    <Text size="xs" tone="danger">{item.stats.failed} con error</Text>
                  )}
                </div>

                {/* Las acciones con espera son la parte menos obvia: se listan
                    para que se entienda cuándo sale cada cosa. */}
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {item.actions.map(action => {
                    const def = meta?.actions.find(a => a.key === action.action_type)
                    return (
                      <StatusBadge
                        key={action.id}
                        label={`${def?.label ?? action.action_type} · ${delayLabel(action.delay_minutes)}`}
                        color={NEUTRAL_CHIP}
                      />
                    )
                  })}
                </div>
              </div>

              {isAdmin && (
                <div className="flex items-center gap-2 shrink-0">
                  <Switch
                    checked={item.automation.is_active}
                    disabled={working}
                    onChange={active => onToggle(item, active)}
                    label={`${item.automation.is_active ? 'Pausar' : 'Activar'} ${item.automation.name}`}
                  />
                  <Link
                    href={`/configuracion/automatizaciones/${item.automation.id}`}
                    aria-label={`Editar ${item.automation.name}`}
                    className="inline-flex items-center p-2 rounded-control text-gray-700 hover:bg-gray-100"
                  >
                    <Pencil className="w-4 h-4" />
                  </Link>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Eliminar ${item.automation.name}`}
                    disabled={working}
                    onClick={() => onDelete(item)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>
          </Card>
        )
      })}
    </div>
  )
}

// ── Pestaña: galería de recetas ───────────────────────────────

function RecetasTab({
  catalog, isAdmin, busy, onActivate,
}: {
  catalog: CatalogItem[]
  isAdmin: boolean
  busy: string | null
  onActivate: (recipe: CatalogItem) => void
}) {
  if (catalog.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={<Sparkles className="w-6 h-6" />}
          title="No hay recetas disponibles"
          description="El catálogo de recetas todavía no se cargó en la base."
        />
      </Card>
    )
  }

  return (
    // `auto-rows-fr` + `flex-1` en el detalle: las tarjetas quedan todas de la
    // misma altura y el botón "Activar" a la misma altura en todas, aunque la
    // descripción o la cantidad de acciones cambien de receta a receta.
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 auto-rows-fr">
      {catalog.map(recipe => (
        <Card key={recipe.template_key} className="flex flex-col">
          <div className="flex items-start justify-between gap-2">
            <Heading level={4}>{recipe.name}</Heading>
            {recipe.activated && (
              <StatusBadge label={CATALOG_ACTIVATED.label} color={CATALOG_ACTIVATED.color} />
            )}
          </div>

          {recipe.description && (
            <Text size="sm" tone="muted" className="mt-1.5">{recipe.description}</Text>
          )}

          <div className="mt-3 space-y-1.5 flex-1">
            <div className="flex items-start gap-2">
              <Zap className="w-4 h-4 text-gray-600 shrink-0 mt-0.5" aria-hidden />
              <Text size="xs" tone="muted">{recipe.trigger_label}</Text>
            </div>
            {recipe.action_labels.map((label, i) => (
              <div key={i} className="flex items-start gap-2">
                <ChevronRight className="w-4 h-4 text-gray-600 shrink-0 mt-0.5" aria-hidden />
                <Text size="xs" tone="muted">{label}</Text>
              </div>
            ))}
          </div>

          {!recipe.available && (
            <Alert tone="warning" className="mt-3">
              Alguna de sus acciones todavía no está disponible. Podés activarla igual: esas acciones se
              van a registrar como omitidas hasta que estén listas.
            </Alert>
          )}

          <div className="mt-4 pt-3 border-t border-gray-200">
            {recipe.activated ? (
              <Text size="xs" tone="muted" className="flex items-center gap-1.5">
                <Check className="w-4 h-4 text-gray-600" aria-hidden /> Ya está en tus automatizaciones
              </Text>
            ) : (
              <Button
                fullWidth
                disabled={!isAdmin}
                loading={busy === recipe.template_key}
                onClick={() => onActivate(recipe)}
              >
                Activar
              </Button>
            )}
          </div>
        </Card>
      ))}
    </div>
  )
}

// ── Pestaña: historial ────────────────────────────────────────

function HistorialTab({
  runs, items, meta,
}: {
  runs: AutomationRun[]
  items: AutomationListItem[]
  meta: AutomationsMeta | null
}) {
  const nameById = new Map(items.map(i => [i.automation.id, i.automation.name]))
  // El backend guarda la clave técnica ('lead.stage_changed', 'send_email');
  // acá se muestra la etiqueta del catálogo, igual que en el resto del módulo.
  const triggerLabel = (key: string) => meta?.triggers.find(t => t.key === key)?.label ?? key
  const actionLabel = (key: string) => meta?.actions.find(a => a.key === key)?.label ?? key

  if (runs.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={<History className="w-6 h-6" />}
          title="Todavía no hay ejecuciones"
          description="Cuando una automatización se dispare, vas a ver acá qué hizo y a quién."
        />
      </Card>
    )
  }

  return (
    <div className="space-y-2">
      {runs.map(run => {
        const status = runStatusConfig(run.status)
        const skip = skipReasonLabel(run.skip_reason)
        return (
          <Card key={run.id} padded={false} className="p-4">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Text weight="medium">{nameById.get(run.automation_id) ?? 'Automatización eliminada'}</Text>
                  <StatusBadge label={status.label} color={status.color} />
                </div>
                <Text size="xs" tone="muted" className="mt-0.5">
                  {triggerLabel(run.trigger_event)} · {fmtDateTime(run.created_at)}
                </Text>
                {skip && <Text size="xs" tone="muted" className="mt-1">{skip}</Text>}
              </div>

              {run.actions.length > 0 && (
                <div className="flex flex-wrap gap-1.5 shrink-0">
                  {run.actions.map(action => {
                    const cfg = runActionStatusConfig(action.status)
                    return (
                      <StatusBadge
                        key={action.id}
                        label={`${actionLabel(action.action_type)}: ${cfg.label}`}
                        color={cfg.color}
                        size="sm"
                      />
                    )
                  })}
                </div>
              )}
            </div>
          </Card>
        )
      })}
    </div>
  )
}
