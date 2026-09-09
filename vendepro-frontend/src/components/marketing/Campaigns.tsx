'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Megaphone, ExternalLink, Settings, HelpCircle } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { Card } from '@/components/ui/Card'
import { Heading, Text } from '@/components/ui/Typography'
import { Alert } from '@/components/ui/Alert'
import { EmptyState } from '@/components/ui/EmptyState'
import { Select } from '@/components/ui/Input'
import { Table, type Column } from '@/components/ui/Table'

export type CampaignGoal = 'captacion' | 'demanda'

export interface CampaignRow {
  campaign_id: string
  campaign_name: string
  spend: number
  impressions: number
  clicks: number
  leads: number
  account_currency: string | null
  crm_leads: number
  crm_calificados: number
  crm_ganados: number
  cpl_crm: number | null
  cpl_meta: number | null
  income_usd?: number | null
  operations?: number
  roi?: number | null
  goal: CampaignGoal | null
}

export interface CampaignsResponse {
  status: 'ok' | 'not_configured' | 'missing_ad_account' | 'token_error' | 'api_error'
  error: string | null
  campaigns: CampaignRow[]
  /**
   * Opcionales a propósito: la respuesta de campañas se cachea 15 minutos en
   * Cloudflare, así que durante ese rato después de un deploy puede llegar el
   * payload de la versión anterior, sin estos campos.
   */
  unclassified?: CampaignRow[]
  unclassified_spend?: number
}

function fmtMoney(value: number, currency: string | null): string {
  try {
    return new Intl.NumberFormat('es-AR', currency
      ? { style: 'currency', currency, maximumFractionDigits: 0 }
      : { maximumFractionDigits: 0 }).format(value)
  } catch {
    return `${currency ?? ''} ${Math.round(value).toLocaleString('es-AR')}`.trim()
  }
}

export default function Campaigns({ data, goalLabel, onChange }: {
  data: CampaignsResponse | null
  /** Cómo se llama el resultado en esta sección: "Captados" o "Cerrados". */
  goalLabel: string
  onChange: () => void
}) {
  const { toast } = useToast()
  const [saving, setSaving] = useState<string | null>(null)

  async function setGoal(row: CampaignRow, goal: CampaignGoal | null) {
    setSaving(row.campaign_id)
    try {
      const res = await apiFetch('crm', '/marketing/campaign-goal', {
        method: 'PUT',
        body: JSON.stringify({
          campaign_id: row.campaign_id,
          campaign_name: row.campaign_name,
          goal,
        }),
      })
      if (!res.ok) throw new Error('No se pudo guardar')
      onChange()
    } catch {
      toast('No se pudo guardar el objetivo de la campaña', 'error')
    } finally {
      setSaving(null)
    }
  }

  const goalSelect = (row: CampaignRow) => (
    <Select
      aria-label={`Objetivo de ${row.campaign_name}`}
      value={row.goal ?? ''}
      disabled={saving === row.campaign_id}
      onChange={e => setGoal(row, (e.target.value || null) as CampaignGoal | null)}
      className="text-xs py-1"
    >
      <option value="">Sin clasificar</option>
      <option value="captacion">Captación</option>
      <option value="demanda">Demanda</option>
    </Select>
  )

  const columns: Column<CampaignRow>[] = [
    {
      key: 'campaign_name', header: 'Campaña',
      render: r => <span className="font-medium text-gray-700" title={r.campaign_name}>{r.campaign_name}</span>,
    },
    { key: 'spend', header: 'Gasto', align: 'right', sortable: true, render: r => fmtMoney(r.spend, r.account_currency) },
    { key: 'impressions', header: 'Impresiones', align: 'right', sortable: true, render: r => r.impressions.toLocaleString('es-AR') },
    { key: 'clicks', header: 'Clicks', align: 'right', sortable: true, render: r => r.clicks.toLocaleString('es-AR') },
    { key: 'leads', header: 'Leads Meta', align: 'right', sortable: true },
    { key: 'crm_leads', header: 'Leads CRM', align: 'right', sortable: true },
    { key: 'crm_calificados', header: 'Calificados', align: 'right', sortable: true },
    { key: 'crm_ganados', header: goalLabel, align: 'right', sortable: true, render: r => <span className="font-semibold text-success">{r.crm_ganados}</span> },
    // Dos columnas y no una: gasto ÷ leads del CRM y gasto ÷ leads de Meta son
    // números distintos. Mezclarlos hace que las filas no se puedan comparar.
    { key: 'cpl_crm', header: 'CPL (CRM)', align: 'right', render: r => r.cpl_crm != null ? <span className="font-semibold text-ink">{fmtMoney(r.cpl_crm, r.account_currency)}</span> : <span className="text-gray-300">—</span> },
    { key: 'cpl_meta', header: 'CPL (Meta)', align: 'right', render: r => r.cpl_meta != null ? fmtMoney(r.cpl_meta, r.account_currency) : <span className="text-gray-300">—</span> },
    {
      key: 'income_usd', header: 'Honorarios', align: 'right', sortable: true,
      render: r => r.income_usd != null
        ? new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(r.income_usd)
        : <span className="text-gray-300">—</span>,
    },
    {
      key: 'roi', header: 'ROI', align: 'right', sortable: true,
      render: r => {
        // Sin cierres atribuidos, o sin poder pasar el gasto a dólares, el ROI
        // no existe: 0% haría parecer mala una campaña a la que le falta el dato.
        if (r.roi == null) {
          return <span className="text-xs text-gray-400">{r.income_usd == null ? 'Sin cierres' : 'Sin conversión'}</span>
        }
        return (
          <span className={`font-semibold ${r.roi >= 0 ? 'text-success' : 'text-danger'}`}>
            {r.roi > 0 ? '+' : ''}{r.roi.toLocaleString('es-AR')}%
          </span>
        )
      },
    },
    // Cada uno clasifica las campañas de su propia cuenta publicitaria.
    { key: 'goal', header: 'Objetivo', render: goalSelect },
  ]

  return (
    <Card>
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div>
          <Heading level={4} className="flex items-center gap-2"><Megaphone className="w-4 h-4 text-[#1877F2]" /> Campañas activas</Heading>
          <Text size="xs" tone="muted" className="mt-0.5">Performance por campaña de tu cuenta publicitaria</Text>
        </div>
        <a href="https://adsmanager.facebook.com" target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-[#1877F2] font-medium hover:underline">
          Abrir Meta Ads <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      {data === null ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />)}
        </div>
      ) : data.status === 'not_configured' ? (
        <EmptyState
          icon={<Megaphone className="w-6 h-6" />}
          title="Conectá Meta Conversion API para ver campañas"
          description="Gasto, leads, calificados y CPL por campaña"
          action={
            <Link href="/configuracion/marketing"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-control bg-primary text-white text-sm font-medium hover:bg-primary-hover transition-colors">
              <Settings className="w-4 h-4" /> Configurar ahora
            </Link>
          }
        />
      ) : data.status === 'missing_ad_account' ? (
        <Alert tone="info" title="Todo listo — falta el Ad Account ID">
          <p>
            Cargá tu Ad Account (act_…) en Ajustes → Marketing y asegurate de que el token tenga permiso <code>ads_read</code>.
            Las campañas aparecen solas al guardarlo.
          </p>
          <Link href="/configuracion/marketing"
            className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-control bg-primary text-white text-sm font-medium hover:bg-primary-hover transition-colors">
            <Settings className="w-4 h-4" /> Completar configuración
          </Link>
        </Alert>
      ) : data.status !== 'ok' ? (
        <Alert tone="danger" title="No se pudieron leer las campañas de Meta">
          <p>
            {data.status === 'token_error'
              ? 'El token guardado no es válido — volvé a cargarlo en Ajustes → Marketing.'
              : data.error ?? 'Error desconocido.'}
          </p>
          <p className="mt-1">
            Si el error menciona permisos, el token necesita <code>ads_read</code> sobre el ad account (se agrega en Meta Business → System Users).
          </p>
        </Alert>
      ) : (() => {
        const unclassified = data.unclassified ?? []
        const unclassifiedSpend = data.unclassified_spend ?? 0
        return (
        <>
          {/* Las campañas sin etiquetar quedan afuera de las dos secciones a
              propósito: repartirlas en las dos duplicaría el gasto. Se muestran
              acá, con el gasto suelto a la vista, para que se note que falta. */}
          {unclassified.length > 0 && (
            <Alert tone="warning" title={`${unclassified.length} campaña${unclassified.length === 1 ? '' : 's'} sin clasificar`} className="mb-4">
              <p>
                No cuenta{unclassified.length === 1 ? '' : 'n'} en ninguna de las dos secciones —
                repartir el mismo gasto en las dos dejaría el costo por captación a la mitad del real.
                Son <b>{fmtMoney(unclassifiedSpend, unclassified[0]?.account_currency ?? null)}</b> sin
                asignar.
              </p>
              <div className="mt-3 space-y-2">
                {unclassified.map(r => (
                  <div key={r.campaign_id} className="flex items-center justify-between gap-3 flex-wrap">
                    <span className="text-sm font-medium text-gray-700 min-w-0 truncate">{r.campaign_name}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-sm text-gray-600">{fmtMoney(r.spend, r.account_currency)}</span>
                      {goalSelect(r)}
                    </div>
                  </div>
                ))}
              </div>
            </Alert>
          )}

          {data.campaigns.length === 0 ? (
            <Text tone="muted" className="text-center py-8">
              {unclassified.length > 0
                ? 'Ninguna campaña clasificada en esta sección todavía'
                : 'Sin campañas con actividad en este período'}
            </Text>
          ) : (
            <>
              <Table columns={columns} data={data.campaigns} rowKey={r => r.campaign_id} />
              <Text size="xs" tone="muted" className="mt-2 flex items-start gap-1.5">
                <HelpCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>
                  Leads CRM atribuidos por nombre de campaña contra el origen del lead — si renombrás la
                  campaña en Ads Manager, la fila deja de matchear. El objetivo, en cambio, se guarda
                  contra el id: renombrar no lo rompe. Datos de Meta cacheados 15 min.
                </span>
              </Text>
            </>
          )}
        </>
        )
      })()}
    </Card>
  )
}
