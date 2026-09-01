'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Building2, ExternalLink, Ruler, Eye, TrendingUp, Shield, Pencil, Loader2, MapPin, Target, User } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { DetailHeader, DetailMeta } from '@/components/ui/DetailHeader'
import { getAppraisalStatus } from '@/lib/crm-config'
import { Heading, Text } from '@/components/ui/Typography'
import { Alert } from '@/components/ui/Alert'
import { Table, type Column } from '@/components/ui/Table'
import { TemplateRenderer } from '@/components/tasaciones/renderer/TemplateRenderer'
import type {
  AppraisalContext, TemplateBlock, BlockOverrides,
} from '@/components/tasaciones/renderer/types'
import '@/components/tasaciones/renderer/print.css'

// Tonos sobre la superficie oscura de "Tasación proyectada": van en -400 porque
// los tokens del DS están calibrados para fondo claro y sobre gray-900 no
// contrastan. Misma decisión que la superficie: único uso en la app.
const DARK_WARN = 'text-yellow-400' // ds-todo: sin tono del DS para fondo oscuro
const DARK_OK = 'text-green-400' // ds-todo: sin tono del DS para fondo oscuro

function parseJson<T>(v: unknown): T | null {
  if (!v) return null
  if (typeof v === 'object') return v as T
  if (typeof v === 'string') { try { return JSON.parse(v) as T } catch { return null } }
  return null
}

function buildCtx(a: any): AppraisalContext {
  return {
    id: a.id,
    property_address: a.property_address,
    neighborhood: a.neighborhood ?? null,
    city: a.city ?? null,
    property_type: a.property_type ?? null,
    covered_area: a.covered_area ?? null,
    total_area: a.total_area ?? null,
    semi_area: a.semi_area ?? null,
    weighted_area: a.weighted_area ?? null,
    swot: {
      strengths: a.strengths ?? null,
      weaknesses: a.weaknesses ?? null,
      opportunities: a.opportunities ?? null,
      threats: a.threats ?? null,
    },
    prices: {
      suggested: a.suggested_price ?? null,
      test: a.test_price ?? null,
      expected_close: a.expected_close_price ?? null,
      usd_per_m2: a.usd_per_m2 ?? null,
    },
    comparables: a.comparables ?? [],
    agent: a.agent ?? null,
    org: a.org ?? null,
  }
}

// Columnas de la tabla de comparables (presentación pura).
const comparableColumns: Column<any>[] = [
  {
    key: 'address',
    header: 'Dirección',
    render: (c: any) => (
      <div className="min-w-0">
        <p className="font-medium text-ink truncate max-w-[150px] sm:max-w-none">{c.address || 'Sin dirección'}</p>
        {c.zonaprop_url && (
          <a href={c.zonaprop_url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-indigo-500 hover:underline">
            Ver aviso →
          </a>
        )}
      </div>
    ),
  },
  { key: 'total_area', header: 'm²', align: 'center', render: (c: any) => c.total_area || '-' },
  {
    key: 'price',
    header: 'Precio',
    align: 'center',
    render: (c: any) => (
      <span className="font-semibold text-primary">
        {c.price ? `$${Number(c.price).toLocaleString('es-AR')}` : '-'}
      </span>
    ),
  },
  {
    key: 'usd_per_m2',
    header: 'USD/m²',
    align: 'center',
    render: (c: any) => (c.usd_per_m2 ? Number(c.usd_per_m2).toLocaleString('es-AR') : '-'),
  },
  { key: 'days_on_market', header: 'Días', align: 'center', render: (c: any) => c.days_on_market || '-' },
  { key: 'views_per_day', header: 'Vistas/d', align: 'center', render: (c: any) => c.views_per_day || '-' },
]

export default function TasacionDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [appraisal, setAppraisal] = useState<any>(null)
  const [comparables, setComparables] = useState<any[]>([])
  const [linkedLead, setLinkedLead] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const res = await apiFetch('properties', `/appraisals?id=${id}`)
        const data = (await res.json()) as any
        if (data.error || !data.id) { router.push('/tasaciones'); return }
        setAppraisal(data)
        setComparables(data.comparables || [])
        if (data.lead_id) {
          try {
            const lr = await apiFetch('crm', `/leads?id=${data.lead_id}`)
            const ld = (await lr.json()) as any
            if (ld.id) setLinkedLead(ld)
          } catch {}
        }
      } catch { router.push('/tasaciones') }
      setLoading(false)
    }
    load()
  }, [id, router])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!appraisal) return null

  const a = appraisal
  const snapshot = parseJson<TemplateBlock[]>(a.template_snapshot_json) ?? []
  const hasTemplate = !!a.template_id && snapshot.length > 0

  // Header compartido (aplica para ambos modos). Es el molde `DetailHeader`, el
  // mismo de contacto, lead y propiedad. Antes era un <h1> con clases sueltas,
  // dos <Link> con estilo de botón a mano y tres chips de colores distintos
  // (azul para el lead, rosa para la propiedad, gris para el contacto) que en
  // realidad son todos lo mismo: un dato del encabezado.
  const st = getAppraisalStatus(a.status)
  const header = (
    <>
      <Link href="/tasaciones" className="inline-flex items-center gap-1.5 text-gray-500 hover:text-gray-700 text-sm font-medium mb-4">
        <ArrowLeft className="w-4 h-4" /> Volver a Tasaciones
      </Link>

      <DetailHeader
        className="mb-6"
        title={a.property_address}
        badges={<StatusBadge label={st.label} color={st.color} />}
        meta={
          <>
            {(a.neighborhood || a.city) && (
              <DetailMeta icon={<MapPin className="w-4 h-4" />}>
                {[a.neighborhood, a.city].filter(Boolean).join(', ')}
              </DetailMeta>
            )}
            {linkedLead && (
              <DetailMeta icon={<Target className="w-4 h-4" />}>
                Lead origen{' '}
                <Link href={`/leads/${linkedLead.id}`} className="font-medium text-ink hover:text-primary">
                  {linkedLead.full_name}
                </Link>
              </DetailMeta>
            )}
            {!linkedLead && a.contact_name && (
              <DetailMeta icon={<User className="w-4 h-4" />}>
                Contacto <span className="font-medium text-ink">{a.contact_name}</span>
              </DetailMeta>
            )}
            {a.linked_property && (
              <DetailMeta icon={<Building2 className="w-4 h-4" />}>
                Propiedad{' '}
                <Link href={`/propiedades/${a.linked_property.id}`} className="font-medium text-ink hover:text-primary">
                  {a.linked_property.address}
                </Link>
              </DetailMeta>
            )}
          </>
        }
        actions={
          <>
            <Button href={`/tasaciones/${id}/editar`} variant="outline" icon={<Pencil className="w-4 h-4" />}>
              Editar
            </Button>
            {a.public_slug && (
              <Button href={`/t/${a.public_slug}`} target="_blank" rel="noopener noreferrer" icon={<ExternalLink className="w-4 h-4" />}>
                Ver landing
              </Button>
            )}
          </>
        }
      />
    </>
  )

  if (hasTemplate) {
    const overrides = parseJson<BlockOverrides>(a.block_overrides_json) ?? {}
    const ctx = buildCtx(a)
    return (
      <div>
        {header}
        <Card padded={false} className="overflow-hidden">
          <TemplateRenderer
            snapshot={snapshot}
            overrides={overrides}
            appraisal={ctx}
            mode="web"
          />
        </Card>
      </div>
    )
  }

  // Fallback: layout hardcodeado para tasaciones previas al sistema de templates.
  const weighted = Number(a.weighted_area) || 0
  const usdM2 = Number(a.usd_per_m2) || 0

  return (
    <div>
      {header}

      <div className="space-y-4">
        {/* ds-todo: portada de la tasación LEGACY (aspect 794/1123 = A4). No es
            UI de la app sino un documento para el cliente, del mismo tipo que
            tasaciones/renderer, que está excluido del ratchet a propósito. El
            gradiente acá es superficie, no color de ícono. */}
        <div className="bg-gradient-to-br from-brand-pink via-[#ff3d94] to-brand-orange rounded-2xl p-6 sm:p-10 text-white shadow-lg aspect-[794/1123] flex flex-col justify-between relative overflow-hidden">
          <div>
            <img src="/brand/logo-horizontal.png" alt="Logo" className="h-8 sm:h-12 brightness-0 invert mb-4" />
            <p className="text-white/70 text-xs sm:text-sm font-medium tracking-wider uppercase">Propuesta de tasación</p>
          </div>
          <div>
            <h2 className="text-2xl sm:text-4xl font-bold leading-tight mb-2">{a.property_address}</h2>
            <p className="text-white/80 text-sm sm:text-lg">{a.neighborhood}, {a.city}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white font-bold">
              {(a.agent_name || 'A').charAt(0)}
            </div>
            <div>
              <p className="font-semibold text-sm">{a.agent_name}</p>
              <p className="text-white/70 text-xs">{a.agent_phone} · {a.agent_email}</p>
            </div>
          </div>
        </div>

        <Card className="p-5 sm:p-8">
          <Heading level={3} className="text-lg sm:text-xl mb-4 flex items-center gap-2">
            <Ruler className="w-5 h-5 text-gray-600" />
            Datos de la propiedad
          </Heading>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <div className="bg-gray-50 rounded-card p-3 text-center">
              <p className="text-[10px] sm:text-xs text-gray-500">Tipología</p>
              <p className="font-bold text-sm text-ink capitalize">{a.property_type}</p>
            </div>
            <div className="bg-gray-50 rounded-card p-3 text-center">
              <p className="text-[10px] sm:text-xs text-gray-500">Sup. cubierta</p>
              <p className="font-bold text-sm text-ink">{a.covered_area || '-'} m²</p>
            </div>
            <div className="bg-gray-50 rounded-card p-3 text-center">
              <p className="text-[10px] sm:text-xs text-gray-500">Sup. total</p>
              <p className="font-bold text-sm text-ink">{a.total_area || '-'} m²</p>
            </div>
            <div className="bg-primary/5 border border-primary/20 rounded-card p-3 text-center">
              <p className="text-[10px] sm:text-xs text-gray-500">Ponderada</p>
              <p className="font-bold text-sm text-primary">{weighted.toFixed(1)} m²</p>
            </div>
          </div>

          {(a.strengths || a.weaknesses || a.opportunities || a.threats) && (
            <div>
              <Heading level={4} className="text-sm text-gray-700 mb-3 flex items-center gap-2">
                <Shield className="w-4 h-4 text-indigo-500" />
                Análisis FODA
              </Heading>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {a.strengths && (
                  <Alert tone="success" title="Fortalezas" hideIcon className="p-3">
                    <p className="whitespace-pre-wrap">{a.strengths}</p>
                  </Alert>
                )}
                {a.weaknesses && (
                  <Alert tone="danger" title="Debilidades" hideIcon className="p-3">
                    <p className="whitespace-pre-wrap">{a.weaknesses}</p>
                  </Alert>
                )}
                {a.opportunities && (
                  <Alert tone="info" title="Oportunidades" hideIcon className="p-3">
                    <p className="whitespace-pre-wrap">{a.opportunities}</p>
                  </Alert>
                )}
                {a.threats && (
                  <Alert tone="warning" title="Amenazas" hideIcon className="p-3">
                    <p className="whitespace-pre-wrap">{a.threats}</p>
                  </Alert>
                )}
              </div>
            </div>
          )}

          {a.publication_analysis && (
            <Alert tone="warning" title="Análisis de publicación actual" className="mt-4">
              <p className="whitespace-pre-wrap">{a.publication_analysis}</p>
            </Alert>
          )}
        </Card>

        {comparables.length > 0 && (
          <Card className="p-5 sm:p-8">
            <Heading level={3} className="text-lg sm:text-xl mb-4 flex items-center gap-2">
              <Eye className="w-5 h-5 text-indigo-500" />
              Departamentos publicados en la zona
            </Heading>

            <Table
              columns={comparableColumns}
              data={comparables}
              rowKey={(_, i) => String(i)}
            />
          </Card>
        )}

        {/* ds-todo: superficie oscura sin mapeo en el DS. Revisado en la tanda de
            decisiones: NO se crea `Card tone="dark"` — es el único uso en toda la
            app. Si otro panel de resultado (reportes, prefactibilidades) adopta
            este look, ahí sí se promueve. Ver doc/ds-review.md. */}
        <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-card p-5 sm:p-8 text-white shadow-card">
          <h2 className="text-lg sm:text-xl font-bold mb-6 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            Tasación proyectada
          </h2>

          <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-6">
            <div className="bg-white/10 rounded-control p-4 text-center">
              <p className="text-xs text-white/60">Sup. ponderada</p>
              <p className="text-xl sm:text-2xl font-bold">{weighted.toFixed(1)} m²</p>
            </div>
            <div className="bg-white/10 rounded-control p-4 text-center">
              <p className="text-xs text-white/60">USD/m² promedio</p>
              <p className="text-xl sm:text-2xl font-bold">{usdM2.toLocaleString('es-AR')}</p>
            </div>
          </div>

          <div className="space-y-3">
            {a.test_price && (
              <div className="bg-white/5 border border-white/10 rounded-control p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-white/60">Valor de publicación prueba</p>
                  <p className="text-xs text-white/40">Primeros 30 días</p>
                </div>
                <p className={cn('text-xl sm:text-2xl font-bold', DARK_WARN)}>
                  USD {Number(a.test_price).toLocaleString('es-AR')}
                </p>
              </div>
            )}

            {a.suggested_price && (
              <div className="bg-primary/20 border border-primary/30 rounded-control p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-white/80 font-semibold">Valor sugerido</p>
                  <p className="text-xs text-white/40">Valor de mercado</p>
                </div>
                <p className="text-2xl sm:text-3xl font-bold text-primary">
                  USD {Number(a.suggested_price).toLocaleString('es-AR')}
                </p>
              </div>
            )}

            {a.expected_close_price && (
              <div className="bg-white/5 border border-white/10 rounded-control p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-white/60">Precio de cierre esperado</p>
                  <p className="text-xs text-white/40">120 días</p>
                </div>
                <p className={cn('text-xl sm:text-2xl font-bold', DARK_OK)}>
                  USD {Number(a.expected_close_price).toLocaleString('es-AR')}
                </p>
              </div>
            )}

            {usdM2 > 0 && (
              <div className="text-center pt-2">
                <p className="text-xs text-white/40">
                  {usdM2.toLocaleString('es-AR')} USD/m² × {weighted.toFixed(1)} m² = USD {Math.round(usdM2 * weighted).toLocaleString('es-AR')}
                </p>
              </div>
            )}
          </div>
        </div>

        <Card className="p-5 sm:p-8 text-center">
          <img src="/brand/logo-horizontal.png" alt="Logo" className="h-8 sm:h-10 mx-auto mb-3" />
          <Text weight="semibold">Marcela Genta · Operaciones Inmobiliarias</Text>
          <Text size="xs" tone="muted" className="mt-1">{a.agent_name} · {a.agent_phone}</Text>
          <Text size="xs" className="text-gray-400 mt-1">{a.agent_email}</Text>
          <Text size="xs" className="text-[10px] text-gray-300 mt-3">
            Todas las operaciones inmobiliarias son objeto de intermediación y conclusión por parte de Marcela Genta,
            Colegio Profesional Inmobiliario Matrícula N°3906
          </Text>
        </Card>
      </div>
    </div>
  )
}
