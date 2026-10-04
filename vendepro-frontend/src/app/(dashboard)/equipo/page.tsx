'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Users, AlertTriangle, Clock, Trophy, Inbox } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { canSeeAll, getStageConfig, type LeadPipelineKey } from '@/lib/crm-config'
import { useCurrentUser } from '@/lib/use-current-user'
import { PageHeader } from '@/components/ui/PageHeader'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { Card } from '@/components/ui/Card'
import { Table, type Column } from '@/components/ui/Table'
import { StatTile } from '@/components/ui/StatTile'
import { StageBadge } from '@/components/ui/StageBadge'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Heading, Text } from '@/components/ui/Typography'
import { EmptyState } from '@/components/ui/EmptyState'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'

interface AgentRow {
  id: string
  full_name: string
  role: string
  total_leads: number
  activos: number
  captados: number
  conversion: number
  sin_contactar_24h: number
  sin_movimiento_7d: number
  por_etapa: Record<string, number>
  actividad_mes: number
  ultimo_movimiento: string | null
  en_24h_pct: number | null
  mediana_respuesta_h: number | null
  respuesta_sin_dato: number
}

interface Board {
  pipeline: LeadPipelineKey
  agents: AgentRow[]
  sin_asignar: { total: number; sin_contactar_24h: number }
  totales: { total_leads: number; activos: number; captados: number; conversion: number; sin_contactar_24h: number; sin_movimiento_7d: number }
}

/** Los mismos cortes que usa la tarjeta Equipo del dashboard (≥20 / ≥10). */
function conversionColor(pct: number): string {
  if (pct >= 20) return 'bg-success/10 text-success'
  if (pct >= 10) return 'bg-warning/10 text-warning'
  return 'bg-danger/10 text-danger'
}

/** La regla del negocio es contactar dentro de las 24h: verde si la cumple casi siempre. */
function sla24hColor(pct: number): string {
  if (pct >= 90) return 'bg-success/10 text-success'
  if (pct >= 70) return 'bg-warning/10 text-warning'
  return 'bg-danger/10 text-danger'
}

/** 0.5 → "30 min"; 3.2 → "3 h"; 40 → "1.7 d". */
function formatHoras(h: number): string {
  if (h < 1) return `${Math.round(h * 60)} min`
  if (h < 48) return `${h < 10 ? h.toFixed(1) : Math.round(h)} h`
  return `${(h / 24).toFixed(1)} d`
}

function timeAgo(iso: string | null): string {
  if (!iso) return '—'
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  if (days <= 0) return 'Hoy'
  if (days === 1) return 'Ayer'
  if (days < 7) return `Hace ${days} días`
  if (days < 30) return `Hace ${Math.floor(days / 7)} sem`
  return `Hace ${Math.floor(days / 30)} meses`
}

/** Las 3 etapas donde más leads tiene, para ver de un vistazo dónde está parado. */
function topStages(porEtapa: Record<string, number>, pipeline: LeadPipelineKey) {
  return Object.entries(porEtapa)
    .filter(([stage]) => getStageConfig(stage, pipeline).label !== '')
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
}

export default function EquipoPage() {
  const { user, listo } = useCurrentUser()
  const [pipeline, setPipeline] = useState<LeadPipelineKey>('vendedor')
  const [board, setBoard] = useState<Board | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    setLoading(true)
    setError(false)
    apiFetch('analytics', `/team-board?pipeline=${pipeline}`)
      .then(r => r.json() as Promise<any>)
      .then(d => {
        if (d?.agents) setBoard(d as Board)
        else setError(true)
        setLoading(false)
      })
      .catch(() => { setError(true); setLoading(false) })
  }, [pipeline])

  // El permiso real lo aplica el backend (403); esto evita pintar una pantalla
  // vacía al agente que entra por la URL.
  if (!listo) return <Card><Text tone="muted">Cargando…</Text></Card>
  if (!user || !canSeeAll(user.role)) {
    return (
      <EmptyState
        icon={<Users className="w-6 h-6" />}
        title="Sólo para la inmobiliaria"
        description="El tablero del equipo lo ven administradores y supervisores. Tus propios números están en Mi performance."
        action={<Button href="/mi-performance">Ver mi performance</Button>}
      />
    )
  }

  const columns: Column<AgentRow>[] = [
    {
      key: 'full_name',
      header: 'Agente',
      sortable: true,
      render: r => (
        <div className="min-w-0">
          <p className="font-medium text-ink truncate">{r.full_name}</p>
          <Text size="xs" tone="muted">Últ. movimiento: {timeAgo(r.ultimo_movimiento)}</Text>
        </div>
      ),
    },
    {
      key: 'activos',
      header: 'Activos',
      align: 'right',
      sortable: true,
      render: r => <span className="font-medium text-ink">{r.activos}</span>,
    },
    {
      key: 'por_etapa',
      header: 'Dónde están',
      render: r => {
        const top = topStages(r.por_etapa, pipeline)
        if (top.length === 0) return <Text size="xs" tone="muted">—</Text>
        return (
          <div className="flex flex-wrap gap-1">
            {top.map(([stage, count]) => (
              <span key={stage} className="flex items-center gap-1">
                <StageBadge stage={stage} pipeline={pipeline} size="sm" dot />
                <Text size="xs" tone="muted">{count}</Text>
              </span>
            ))}
          </div>
        )
      },
    },
    {
      key: 'sin_contactar_24h',
      header: 'Sin contactar +24h',
      align: 'right',
      sortable: true,
      render: r => r.sin_contactar_24h > 0
        ? <span className="font-semibold text-danger">{r.sin_contactar_24h}</span>
        : <Text size="sm" tone="muted">0</Text>,
    },
    {
      key: 'sin_movimiento_7d',
      header: 'Parados +7d',
      align: 'right',
      sortable: true,
      render: r => r.sin_movimiento_7d > 0
        ? <span className="font-semibold text-warning">{r.sin_movimiento_7d}</span>
        : <Text size="sm" tone="muted">0</Text>,
    },
    { key: 'captados', header: 'Captados', align: 'right', sortable: true },
    {
      key: 'conversion',
      header: 'Conversión',
      align: 'right',
      sortable: true,
      render: r => (
        <StatusBadge
          label={`${r.conversion}%`}
          color={conversionColor(r.conversion)}
          size="sm"
        />
      ),
    },
    {
      key: 'en_24h_pct',
      header: 'Contactó en 24h',
      align: 'right',
      sortable: true,
      render: r => r.en_24h_pct === null
        ? <Text size="xs" tone="muted">Sin datos</Text>
        : <StatusBadge label={`${r.en_24h_pct}%`} color={sla24hColor(r.en_24h_pct)} size="sm" />,
    },
    {
      key: 'mediana_respuesta_h',
      header: 'Tarda',
      align: 'right',
      sortable: true,
      render: r => r.mediana_respuesta_h === null
        ? <Text size="xs" tone="muted">—</Text>
        : <span className="text-ink">{formatHoras(r.mediana_respuesta_h)}</span>,
    },
    { key: 'actividad_mes', header: 'Actividad 30d', align: 'right', sortable: true },
  ]

  const t = board?.totales

  return (
    <div className="space-y-4">
      <PageHeader
        title="Equipo"
        subtitle="Cómo viene cada agente con los leads que tiene"
        actions={
          <SegmentedControl
            value={pipeline}
            onChange={v => setPipeline(v as LeadPipelineKey)}
            options={[
              { value: 'vendedor', label: 'Vendedores' },
              { value: 'comprador', label: 'Compradores' },
            ]}
          />
        }
      />

      {error && <Alert tone="danger">No se pudo cargar el tablero del equipo.</Alert>}

      {board && board.sin_asignar.total > 0 && (
        <Alert tone="warning" title={`${board.sin_asignar.total} leads sin asignar`}>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <Text size="sm">
              {board.sin_asignar.sin_contactar_24h > 0
                ? `${board.sin_asignar.sin_contactar_24h} ya pasaron las 24 horas sin que nadie los contacte.`
                : 'Todavía no tienen dueño.'}
            </Text>
            <Button href="/leads?agent=none" variant="outline">Ver y repartir</Button>
          </div>
        </Alert>
      )}

      {t && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatTile icon={<Users className="w-4 h-4" />} label="Leads activos" value={t.activos} caption={`${t.total_leads} en total`} />
          <StatTile icon={<Trophy className="w-4 h-4" />} label="Conversión del equipo" value={`${t.conversion}%`} caption={`${t.captados} captados`} tone="success" />
          <StatTile
            icon={<AlertTriangle className="w-4 h-4" />}
            label="Sin contactar +24h"
            value={t.sin_contactar_24h}
            tone="danger"
            emphasis={t.sin_contactar_24h > 0}
            href="/leads?sort=urgency"
          />
          <StatTile icon={<Clock className="w-4 h-4" />} label="Parados +7d" value={t.sin_movimiento_7d} tone="warning" href="/leads?sort=urgency" />
        </div>
      )}

      {loading ? (
        <Card><Text tone="muted">Cargando equipo…</Text></Card>
      ) : !board || board.agents.length === 0 ? (
        <EmptyState
          icon={<Inbox className="w-6 h-6" />}
          title="Todavía no hay nada que mostrar"
          description="Cuando el equipo tenga leads asignados o actividad registrada, acá vas a ver cómo viene cada uno."
        />
      ) : (
        <Card padded={false}>
          <Table
            columns={columns}
            data={board.agents}
            rowKey={r => r.id}
            rowHref={r => `/leads?agent=${r.id}`}
            minWidth={1120}
            renderMobileCard={r => (
              <Link href={`/leads?agent=${r.id}`} className="block p-4 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Heading level={4}>{r.full_name}</Heading>
                  <StatusBadge label={`${r.conversion}%`} color={conversionColor(r.conversion)} size="sm" />
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  <Text size="xs" tone="muted">{r.activos} activos</Text>
                  <Text size="xs" tone="muted">{r.captados} captados</Text>
                  <Text size="xs" tone="muted">{r.actividad_mes} actividades (30d)</Text>
                  {r.en_24h_pct !== null && <Text size="xs" tone="muted">{r.en_24h_pct}% en 24h</Text>}
                  {r.mediana_respuesta_h !== null && <Text size="xs" tone="muted">tarda {formatHoras(r.mediana_respuesta_h)}</Text>}
                </div>
                {(r.sin_contactar_24h > 0 || r.sin_movimiento_7d > 0) && (
                  <div className="flex flex-wrap gap-x-4 gap-y-1">
                    {r.sin_contactar_24h > 0 && <Text size="xs" tone="danger">{r.sin_contactar_24h} sin contactar +24h</Text>}
                    {r.sin_movimiento_7d > 0 && <Text size="xs" tone="muted">{r.sin_movimiento_7d} parados +7d</Text>}
                  </div>
                )}
                <div className="flex flex-wrap gap-1">
                  {topStages(r.por_etapa, pipeline).map(([stage, count]) => (
                    <span key={stage} className="flex items-center gap-1">
                      <StageBadge stage={stage} pipeline={pipeline} size="sm" dot />
                      <Text size="xs" tone="muted">{count}</Text>
                    </span>
                  ))}
                </div>
              </Link>
            )}
            footer={t && (
              <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <Text size="sm" weight="medium">Total inmobiliaria</Text>
                <div className="flex flex-wrap gap-x-6 gap-y-1">
                  <Text size="sm" tone="muted">{t.activos} activos</Text>
                  <Text size="sm" tone="muted">{t.captados} captados</Text>
                  <Text size="sm" tone="muted">{t.conversion}% conversión</Text>
                </div>
              </div>
            )}
          />
        </Card>
      )}
    </div>
  )
}
