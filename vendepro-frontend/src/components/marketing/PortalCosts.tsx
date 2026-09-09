'use client'

import { useState, useEffect } from 'react'
import { Wallet, Plus, Pencil, Trash2, AlertCircle } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { LEAD_SOURCES } from '@/lib/crm-config'
import { useToast } from '@/components/ui/Toast'
import { Card } from '@/components/ui/Card'
import { Heading, Text } from '@/components/ui/Typography'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Field, Input, Select } from '@/components/ui/Input'
import { Table, type Column } from '@/components/ui/Table'
import { EmptyState } from '@/components/ui/EmptyState'
import { Alert } from '@/components/ui/Alert'

export interface PortalCostRow {
  provider: string
  label: string | null
  spend_usd: number | null
  months: number
  months_without_rate: number
  prorated: boolean
  leads: number
  visitas: number
  ganados: number
  cost_per_lead_usd: number | null
  cost_per_visit_usd: number | null
  income_usd: number | null
  operations: number
  roi: number | null
  roas: number | null
  missing: 'sin_gasto' | 'sin_cotizacion' | 'sin_leads' | null
}

export interface PortalCostsData {
  rows: PortalCostRow[]
  summary: {
    spend_usd: number | null
    leads: number
    visitas: number
    ganados: number
    cost_per_lead_usd: number | null
    pending_rate: number
    prorated: boolean
    income_usd: number | null
    operations: number
    roi: number | null
    unattributed_income_usd: number
    unattributed_operations: number
    income_pending_rate: number
  }
}

interface SpendRow {
  id: string
  provider: string
  provider_label: string | null
  period_month: string
  amount: number
  currency: string
  usd_rate: number | null
  usd_rate_source: string | null
  amount_usd: number | null
  notes: string | null
}

// Portales conocidos. La lista se completa con las fuentes que de verdad
// aparecen en los leads de la org, así el gasto siempre matchea con algo.
const KNOWN_PORTALS = ['zonaprop', 'argenprop', 'mercadolibre'] as const

function portalLabel(provider: string, label?: string | null): string {
  return label ?? LEAD_SOURCES[provider as keyof typeof LEAD_SOURCES]?.label ?? provider
}

function usd(value: number | null | undefined): string {
  if (value == null) return '—'
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value)
}

const MISSING_HINT: Record<NonNullable<PortalCostRow['missing']>, string> = {
  sin_gasto: 'Falta cargar el gasto',
  sin_cotizacion: 'Falta la cotización',
  sin_leads: 'Sin leads en el período',
}

/** Mes en curso en formato YYYY-MM. */
function currentMonth(): string {
  const d = new Date()
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

export default function PortalCosts({ data, onChange }: { data: PortalCostsData | null; onChange: () => void }) {
  const [editing, setEditing] = useState<string | null>(null)

  const rows = data?.rows ?? []
  const summary = data?.summary

  const columns: Column<PortalCostRow>[] = [
    {
      key: 'provider', header: 'Portal',
      render: r => <span className="font-medium text-gray-700">{portalLabel(r.provider, r.label)}</span>,
    },
    {
      key: 'spend_usd', header: 'Gasto', align: 'right', sortable: true,
      render: r => r.spend_usd != null
        ? <span>{usd(r.spend_usd)}{r.prorated && <span className="text-gray-400" title="Prorrateado por los días del período"> *</span>}</span>
        : <span className="text-gray-300">—</span>,
    },
    { key: 'leads', header: 'Leads', align: 'right', sortable: true },
    {
      key: 'cost_per_lead_usd', header: 'Costo / lead', align: 'right', sortable: true,
      render: r => r.cost_per_lead_usd != null
        ? <span className="font-semibold text-ink">{usd(r.cost_per_lead_usd)}</span>
        : <span className="text-xs text-gray-400">{r.missing ? MISSING_HINT[r.missing] : '—'}</span>,
    },
    { key: 'visitas', header: 'Visitas', align: 'right', sortable: true },
    {
      key: 'cost_per_visit_usd', header: 'Costo / visita', align: 'right',
      render: r => r.cost_per_visit_usd != null ? usd(r.cost_per_visit_usd) : <span className="text-gray-300">—</span>,
    },
    {
      key: 'ganados', header: 'Cerrados', align: 'right',
      render: r => <span className="font-semibold text-success">{r.ganados}</span>,
    },
    {
      key: 'income_usd', header: 'Honorarios', align: 'right', sortable: true,
      render: r => r.income_usd != null
        ? <span>{usd(r.income_usd)}</span>
        : <span className="text-gray-300">—</span>,
    },
    {
      key: 'roi', header: 'ROI', align: 'right', sortable: true,
      render: r => {
        if (r.roi == null) {
          // Sin gasto o sin ingreso el ROI no existe. Mostrar 0% haría parecer
          // malo un canal que simplemente no tiene el dato cargado todavía.
          return <span className="text-xs text-gray-400">{r.income_usd == null ? 'Sin cierres' : 'Sin gasto'}</span>
        }
        return (
          <span className={`font-semibold ${r.roi >= 0 ? 'text-success' : 'text-danger'}`}>
            {r.roi > 0 ? '+' : ''}{r.roi.toLocaleString('es-AR')}%
          </span>
        )
      },
    },
  ]

  return (
    <Card>
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div>
          <Heading level={4} className="flex items-center gap-2"><Wallet className="w-4 h-4 text-gray-600" /> Costo por portal</Heading>
          <Text size="xs" tone="muted" className="mt-0.5">
            Tu presupuesto de publicación, contra los leads que te trajo cada portal
          </Text>
        </div>
        <Button variant="outline" onClick={() => setEditing('')}>
          <Plus className="w-4 h-4" /> Cargar gasto
        </Button>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={<Wallet className="w-6 h-6" />}
          title="Todavía no hay datos de portales"
          description="Cargá lo que pagás por mes en ZonaProp, ArgenProp o MercadoLibre y vas a ver cuánto te sale cada consulta."
          action={<Button onClick={() => setEditing('')}><Plus className="w-4 h-4" /> Cargar gasto</Button>}
        />
      ) : (
        <>
          <Table
            columns={columns}
            data={rows}
            rowKey={r => r.provider}
            actions={r => (
              <button
                type="button"
                onClick={() => setEditing(r.provider)}
                className="p-1.5 rounded-control text-gray-400 hover:text-primary hover:bg-primary/5 transition-colors"
                aria-label={`Cargar gasto de ${portalLabel(r.provider, r.label)}`}
              >
                <Pencil className="w-4 h-4" />
              </button>
            )}
          />

          {summary && (
            <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1">
              <Text size="xs" tone="muted">
                Total: <b className="text-ink">{usd(summary.spend_usd)}</b> · {summary.leads} leads ·
                costo por lead <b className="text-ink">{usd(summary.cost_per_lead_usd)}</b>
                {summary.income_usd != null && (
                  <> · honorarios <b className="text-ink">{usd(summary.income_usd)}</b>
                    {summary.roi != null && (
                      <> · ROI <b className={summary.roi >= 0 ? 'text-success' : 'text-danger'}>
                        {summary.roi > 0 ? '+' : ''}{summary.roi.toLocaleString('es-AR')}%
                      </b></>
                    )}
                  </>
                )}
              </Text>
              {summary.prorated && (
                <Text size="xs" tone="muted">
                  * El gasto mensual se prorratea por los días del período: la factura entera del mes
                  contra unos pocos días de leads daría un costo inflado.
                </Text>
              )}
            </div>
          )}

          {summary && summary.pending_rate > 0 && (
            <Alert tone="warning" title="Falta la cotización del dólar" className="mt-3">
              <p>
                {summary.pending_rate === 1 ? 'Un gasto quedó' : `${summary.pending_rate} gastos quedaron`} sin
                convertir y no suma{summary.pending_rate === 1 ? '' : 'n'} al total. Editá la fila y cargá la
                cotización a mano.
              </p>
            </Alert>
          )}

          {/* Los cierres sin origen conocido no se reparten entre los portales
              —inflaría el ROI de todos— pero tampoco se esconden: si no, la
              suma de la tabla no daría el total real de lo que entró. */}
          {summary && (summary.unattributed_operations ?? 0) > 0 && (
            <Alert tone="info" title="Cierres sin origen atribuido" className="mt-3">
              <p>
                {summary.unattributed_operations === 1
                  ? 'Una operación cerrada aporta'
                  : `${summary.unattributed_operations} operaciones cerradas aportan`}{' '}
                <b>{usd(summary.unattributed_income_usd)}</b> que no se pueden atribuir a ningún portal:
                la propiedad no tiene un comprador marcado como cerrado. No suman al ROI de ningún canal.
              </p>
            </Alert>
          )}
        </>
      )}

      {editing !== null && (
        <SpendModal
          provider={editing}
          knownProviders={[...new Set([...KNOWN_PORTALS, ...rows.map(r => r.provider)])]}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); onChange() }}
        />
      )}
    </Card>
  )
}

function SpendModal({ provider, knownProviders, onClose, onSaved }: {
  provider: string
  knownProviders: string[]
  onClose: () => void
  onSaved: () => void
}) {
  const { toast } = useToast()
  const [form, setForm] = useState({
    provider,
    period_month: currentMonth(),
    amount: '',
    currency: 'ARS',
    usd_rate: '',
    notes: '',
  })
  const [existing, setExisting] = useState<SpendRow | null>(null)
  const [saving, setSaving] = useState(false)

  // Prellenar con lo que ya esté cargado para ese portal y ese mes: el alta y
  // la corrección son la misma operación (upsert por portal + mes).
  useEffect(() => {
    if (!form.provider || !form.period_month) { setExisting(null); return }
    apiFetch('crm', `/marketing/portal-spend?from_month=${form.period_month}&to_month=${form.period_month}`)
      .then(r => r.json() as Promise<SpendRow[]>)
      .then(rows => {
        const hit = rows.find(r => r.provider === form.provider) ?? null
        setExisting(hit)
        if (hit) {
          setForm(f => ({
            ...f,
            amount: String(hit.amount),
            currency: hit.currency,
            usd_rate: hit.usd_rate === null ? '' : String(hit.usd_rate),
            notes: hit.notes ?? '',
          }))
        }
      })
      .catch(() => setExisting(null))
  }, [form.provider, form.period_month])

  async function save() {
    if (!form.provider.trim()) { toast('Elegí el portal', 'error'); return }
    // `Number('')` es 0: sin este corte, dejar el campo vacío guardaría un
    // gasto de cero y el costo por lead del portal daría cero.
    if (form.amount.trim() === '') { toast('Cargá el importe del mes', 'error'); return }
    const amount = Number(form.amount)
    if (!Number.isFinite(amount) || amount < 0) { toast('Importe inválido', 'error'); return }

    setSaving(true)
    try {
      const res = await apiFetch('crm', '/marketing/portal-spend', {
        method: 'PUT',
        body: JSON.stringify({
          provider: form.provider.trim().toLowerCase(),
          period_month: form.period_month,
          amount,
          currency: form.currency,
          usd_rate: form.usd_rate === '' ? null : Number(form.usd_rate),
          notes: form.notes || null,
        }),
      })
      const saved = (await res.json()) as any
      if (!res.ok) throw new Error(saved?.error ?? 'No se pudo guardar')

      toast(
        saved.usd_rate === null
          ? 'Gasto guardado. No se pudo obtener la cotización: cargala a mano para ver el costo por lead.'
          : 'Gasto guardado',
        saved.usd_rate === null ? 'error' : 'success',
      )
      onSaved()
    } catch (e: any) {
      toast(e?.message ?? 'No se pudo guardar', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    if (!existing) return
    setSaving(true)
    try {
      await apiFetch('crm', `/marketing/portal-spend/${existing.id}`, { method: 'DELETE' })
      toast('Gasto eliminado', 'success')
      onSaved()
    } catch {
      toast('No se pudo eliminar', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Gasto en portal"
      icon={<Wallet className="w-5 h-5" />}
      footer={
        <div className="flex items-center justify-between w-full gap-2">
          {existing ? (
            <Button variant="outline" onClick={remove} disabled={saving}>
              <Trash2 className="w-4 h-4" /> Eliminar
            </Button>
          ) : <span />}
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
            <Button onClick={save} disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <Field label="Portal" required hint="Tiene que coincidir con el origen que traen los leads, para poder cruzarlos">
          <Select value={form.provider} onChange={e => setForm(f => ({ ...f, provider: e.target.value }))}>
            <option value="">Elegí un portal…</option>
            {knownProviders.map(p => (
              <option key={p} value={p}>{portalLabel(p)}</option>
            ))}
          </Select>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Mes" required hint="El gasto se factura por mes">
            <Input
              type="month"
              value={form.period_month}
              onChange={e => setForm(f => ({ ...f, period_month: e.target.value }))}
            />
          </Field>
          <Field label="Moneda">
            <Select value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}>
              <option value="ARS">Pesos (ARS)</option>
              <option value="USD">Dólares (USD)</option>
            </Select>
          </Field>
        </div>

        <Field label="Importe del mes" required>
          <Input
            type="number"
            min="0"
            step="0.01"
            value={form.amount}
            onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
            placeholder="0"
          />
        </Field>

        {form.currency !== 'USD' && (
          <Field
            label="Cotización del dólar"
            hint="Se busca sola al guardar (dólar blue). Completala sólo si querés fijar otra: queda congelada con el gasto del mes."
          >
            <Input
              type="number"
              min="0"
              step="0.01"
              value={form.usd_rate}
              onChange={e => setForm(f => ({ ...f, usd_rate: e.target.value }))}
              placeholder="Automática"
            />
          </Field>
        )}

        <Field label="Nota" hint="Opcional — por ejemplo el plan contratado">
          <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
        </Field>

        {existing && (
          <Text size="xs" tone="muted" className="flex items-start gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            Ya hay un gasto cargado para este portal en este mes. Guardar lo corrige, no lo duplica.
          </Text>
        )}
      </div>
    </Modal>
  )
}
