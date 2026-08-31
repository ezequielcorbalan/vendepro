'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Building2, Search, Check, CheckCircle2, ChevronDown } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import type { PropertyConfig } from '@/lib/property-config'
import { stagePillStyle, stageDotStyle, getStage, getStatus, getOpType, stagesForType } from '@/lib/property-config'
import { useToast } from '@/components/ui/Toast'
import { Input, Select } from '@/components/ui/Input'
import { Alert } from '@/components/ui/Alert'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { EmptyState } from '@/components/ui/EmptyState'
import { REPORT_FRESHNESS } from '@/lib/crm-config'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Heading, Text } from '@/components/ui/Typography'

const REPORT_DEADLINE_DAYS = 20

function lastReportInfo(p: any) {
  const dates: Date[] = []
  if (p.last_report_at) { const d = new Date(p.last_report_at); if (!isNaN(d.getTime())) dates.push(d) }
  if (p.last_external_report_at) { const d = new Date(p.last_external_report_at); if (!isNaN(d.getTime())) dates.push(d) }
  if (!dates.length) return { days: null, isExternal: false }
  const mostRecent = new Date(Math.max(...dates.map(d => d.getTime())))
  const days = Math.floor((Date.now() - mostRecent.getTime()) / 86400000)
  const isExternal = !!(p.last_external_report_at && (!p.last_report_at || new Date(p.last_external_report_at) > new Date(p.last_report_at)))
  return { days, isExternal }
}

export default function PropertyFilters({ properties, config }: { properties: any[]; config: PropertyConfig }) {
  const { toast } = useToast()
  const [filter, setFilter] = useState<string>('active')
  const [searchText, setSearchText] = useState('')
  const [externalMarks, setExternalMarks] = useState<Record<string, string | null>>({})
  const [stageOverrides, setStageOverrides] = useState<Record<string, number>>({})
  const [openStageMenu, setOpenStageMenu] = useState<string | null>(null)

  async function toggleExternal(propertyId: string, currentlyMarked: boolean) {
    if (currentlyMarked) {
      setExternalMarks(prev => ({ ...prev, [propertyId]: null }))
      try { await apiFetch('properties', `/properties/${propertyId}/external-report`, { method: 'DELETE' }) } catch {}
    } else {
      setExternalMarks(prev => ({ ...prev, [propertyId]: new Date().toISOString() }))
      try { await apiFetch('properties', `/properties/${propertyId}/external-report`, { method: 'POST' }) } catch {}
    }
  }

  async function changeStage(propertyId: string, stageId: number) {
    const prevStageId = stageOverrides[propertyId]
    setStageOverrides(prev => ({ ...prev, [propertyId]: stageId }))
    setOpenStageMenu(null)
    try {
      const res = await apiFetch('properties', `/properties/${propertyId}/stage`, {
        method: 'PUT',
        body: JSON.stringify({ commercial_stage_id: stageId, override: true }),
      })
      const data = (await res.json().catch(() => ({}))) as any
      if (!res.ok || data.error) {
        setStageOverrides(prev => {
          const n = { ...prev }
          if (prevStageId !== undefined) n[propertyId] = prevStageId
          else delete n[propertyId]
          return n
        })
        toast(data.error || 'Error al cambiar etapa', 'error')
        return
      }
      const newStage = config.commercial_stages.find(s => s.id === stageId)
      if (newStage) toast(`Etapa actualizada: ${newStage.label}`)
    } catch {
      setStageOverrides(prev => {
        const n = { ...prev }
        if (prevStageId !== undefined) n[propertyId] = prevStageId
        else delete n[propertyId]
        return n
      })
      toast('Error de conexión', 'error')
    }
  }

  function effectiveProperty(p: any) {
    return {
      ...p,
      commercial_stage_id: stageOverrides[p.id] ?? p.commercial_stage_id,
      last_external_report_at: externalMarks[p.id] !== undefined ? externalMarks[p.id] : p.last_external_report_at,
    }
  }

  // Etapas terminales (no aparecen en "Activas")
  const terminalIds = useMemo(
    () => new Set(config.commercial_stages.filter(s => s.is_terminal).map(s => s.id)),
    [config]
  )

  const { activeCount, stageCounts } = useMemo(() => {
    const sCount: Record<number, number> = {}
    let active = 0
    for (const p of properties) {
      const csId = stageOverrides[p.id] ?? p.commercial_stage_id
      if (csId) sCount[csId] = (sCount[csId] || 0) + 1
      const statusId = p.status_id ?? 1
      if (!terminalIds.has(csId) && statusId === 1) active++
    }
    return { activeCount: active, stageCounts: sCount }
  }, [properties, stageOverrides, terminalIds])

  const filtered = properties.filter(p => {
    const csId = stageOverrides[p.id] ?? p.commercial_stage_id
    const statusId = p.status_id ?? 1

    if (filter === 'active') {
      if (terminalIds.has(csId)) return false
      if (statusId !== 1) return false
    } else if (filter.startsWith('stage:')) {
      if (csId !== Number(filter.replace('stage:', ''))) return false
    } else if (filter !== 'all') {
      if (statusId !== Number(filter.replace('status:', ''))) return false
    }

    if (searchText.trim()) {
      const q = searchText.toLowerCase()
      const hay = [p.address, p.neighborhood, p.owner_name, p.agent_name, p.property_type]
        .filter(Boolean).join(' ').toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })
  .map(effectiveProperty)
  .sort((a, b) => {
    const aInfo = lastReportInfo(a)
    const bInfo = lastReportInfo(b)
    return (bInfo.days ?? 9999) - (aInfo.days ?? 9999)
  })

  const overdueCount = filtered.filter(p => {
    const info = lastReportInfo(p)
    return info.days === null || info.days >= REPORT_DEADLINE_DAYS
  }).length

  // Etapas con pill en el header. Terminales (perdida/invalida) se excluyen del filtro "Activas"
  // vía terminalIds, pero siguen visibles como pill cuando hay items para poder filtrarlos.
  const followUpSlugs = new Set([
    'propuesta', 'captacion', 'captada', 'publicada', 'con_ofertas', 'reservada',
    'perdida', 'invalida',
  ])
  const visibleStageIds = config.commercial_stages
    .filter(s => followUpSlugs.has(s.slug) && (stageCounts[s.id] || 0) > 0)
    .map(s => s.id)
  // Deduplicate: si hay 'publicada' de venta y de alquiler, mostrar una sola pestaña
  const visibleStages = config.commercial_stages.filter((s, idx, arr) =>
    visibleStageIds.includes(s.id) &&
    arr.findIndex(x => x.slug === s.slug && visibleStageIds.includes(x.id)) === idx
  )

  return (
    <div>
      {/* Búsqueda + filtros: una sola fila compacta (mismo layout que Leads/Contactos) */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 z-10" />
          <Input
            value={searchText} onChange={e => setSearchText(e.target.value)}
            placeholder="Buscar dirección, barrio, propietario, agente..."
            className="pl-9"
          />
        </div>
        <Select aria-label="Etapa" value={filter} onChange={e => setFilter(e.target.value)} className="w-72">
          <option value="active">Activas ({activeCount})</option>
          {visibleStages.map(stage => {
            // Sum counts across both operation types for this slug
            const count = config.commercial_stages
              .filter(s => s.slug === stage.slug)
              .reduce((sum, s) => sum + (stageCounts[s.id] || 0), 0)
            const ids = config.commercial_stages.filter(s => s.slug === stage.slug).map(s => s.id)
            return (
              <option key={stage.slug} value={`stage:${ids[0]}`}>{stage.label} ({count})</option>
            )
          })}
          <option value="all">Todas ({properties.length})</option>
        </Select>
      </div>

      {overdueCount > 0 && (filter === 'active' || filter === 'all') && (
        <Alert tone="warning" className="mb-4">
          <span className="font-semibold">{overdueCount} propiedad{overdueCount !== 1 ? 'es' : ''} sin reportar</span>
          <span className="text-gray-600"> · Hace más de {REPORT_DEADLINE_DAYS} días sin reportes</span>
        </Alert>
      )}

      {openStageMenu && <div className="fixed inset-0 z-[9]" onClick={() => setOpenStageMenu(null)} />}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map((property: any) => {
          const info = lastReportInfo(property)
          const isOverdue = info.days === null || info.days >= REPORT_DEADLINE_DAYS
          const isWarning = info.days !== null && info.days >= 14 && info.days < REPORT_DEADLINE_DAYS
          const externalMarked = !!property.last_external_report_at

          const opType = getOpType(config, property.operation_type_id ?? 1)
          const stage = getStage(config, property.commercial_stage_id)
          const status = getStatus(config, property.status_id ?? 1)
          const opStages = stagesForType(config, property.operation_type_id ?? 1)

          return (
            <Card key={property.id} padded={false} interactive className="overflow-hidden">
              <Link href={`/propiedades/${property.id}`}>
                <div className="h-36 bg-primary/10 flex items-center justify-center relative">
                  <Building2 className="w-10 h-10 text-primary/30" />
                  {isOverdue && (
                    <div className="absolute top-2 left-2">
                      <StatusBadge label={info.days === null ? 'Sin reportes' : `Hace ${info.days}d`} color={REPORT_FRESHNESS.overdue.badge} />
                    </div>
                  )}
                  {isWarning && !isOverdue && (
                    <div className="absolute top-2 left-2">
                      <StatusBadge label={`Hace ${info.days}d`} color={REPORT_FRESHNESS.warning.badge} />
                    </div>
                  )}
                </div>
              </Link>

              <div className="p-4">
                {/* Top row: stage badge (interactive) + non-active status warning */}
                <div className="flex items-center justify-between mb-2.5">
                  <div className="relative">
                    <button
                      aria-label={`Etapa actual: ${stage?.label ?? 'Sin etapa'}. Cambiar etapa`}
                      aria-haspopup="listbox"
                      aria-expanded={openStageMenu === property.id}
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpenStageMenu(openStageMenu === property.id ? null : property.id) }}
                      className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full transition-colors hover:opacity-80 cursor-pointer"
                      style={stage ? stagePillStyle(stage.color) : stagePillStyle()}
                    >
                      {stage && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={stageDotStyle(stage.color)} />}
                      <span>{stage?.label ?? 'Sin etapa'}</span>
                      <ChevronDown className="w-3 h-3 opacity-60" />
                    </button>
                    {openStageMenu === property.id && (
                      <div className="absolute left-0 top-8 z-10 bg-white border border-gray-200 rounded-card shadow-pop py-1 min-w-[160px]">
                        {opStages.map(s => (
                          <button key={s.id}
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); changeStage(property.id, s.id) }}
                            className={`w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 flex items-center gap-2 ${property.commercial_stage_id === s.id ? 'font-semibold text-primary' : 'text-gray-700'}`}
                          >
                            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={stageDotStyle(s.color)} />
                            {s.label}
                            {s.is_terminal && <span className="ml-auto text-[9px] text-gray-400">final</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {/* Status badge — only when non-active (suspended, archived, etc.) */}
                  {status && status.slug !== 'active' && (
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={stagePillStyle(status.color)}>
                      {status.label}
                    </span>
                  )}
                </div>

                <Link href={`/propiedades/${property.id}`}>
                  <Heading level={4} className="mb-0.5 hover:text-primary transition-colors leading-snug">{property.address}</Heading>
                  <Text size="xs" tone="muted">
                    {[property.neighborhood, property.property_type, opType?.label].filter(Boolean).join(' · ')}
                  </Text>
                  {property.asking_price && (
                    <Text size="sm" weight="semibold" tone="primary" className="mt-1">{property.currency} {Number(property.asking_price).toLocaleString('es-AR')}</Text>
                  )}
                  {property.agent_name && <Text size="xs" tone="muted" className="mt-0.5">Agente: {property.agent_name}</Text>}
                  {info.days !== null && (
                    <p className={`text-xs mt-0.5 ${isOverdue ? REPORT_FRESHNESS.overdue.text : isWarning ? REPORT_FRESHNESS.warning.text : 'text-gray-400'}`}>
                      Último reporte: hace {info.days}d{info.isExternal ? ' (ext)' : ''}
                    </p>
                  )}
                </Link>

                <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-2">
                  <Link href={`/propiedades/${property.id}/reportes/nuevo`}
                    className="text-xs text-primary font-medium hover:underline shrink-0">
                    + Reporte
                  </Link>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleExternal(property.id, externalMarked) }}
                    icon={externalMarked ? <CheckCircle2 className="w-3 h-3" /> : <Check className="w-3 h-3" />}
                    className={`text-xs rounded-full px-2 py-0.5 ml-auto ${
                      externalMarked ? 'bg-success/10 text-success border-success/30' : 'text-gray-500'
                    }`}
                  >
                    {externalMarked ? 'Ext.' : 'Hecho fuera'}
                  </Button>
                </div>
              </div>
            </Card>
          )
        })}
      </div>

      {filtered.length === 0 && (
        <Card>
          <EmptyState
            icon={<Building2 className="w-6 h-6" />}
            title={searchText ? 'Sin resultados para esa búsqueda' : 'No hay propiedades en esta etapa'}
            description={searchText ? 'Probá con otra dirección, barrio o propietario' : 'Cambiá el filtro o agregá una nueva propiedad'}
          />
        </Card>
      )}
    </div>
  )
}
