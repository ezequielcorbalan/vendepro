'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, ArrowRight, Save, MapPin, Building2,
  Calculator, BarChart3, FileText, Plus, X
} from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { Card } from '@/components/ui/Card'
import { StatTile } from '@/components/ui/StatTile'
import { Button } from '@/components/ui/Button'
import { Field, Input, Textarea } from '@/components/ui/Input'
import { Heading, Text } from '@/components/ui/Typography'
import { Alert } from '@/components/ui/Alert'
import { Tag } from '@/components/ui/Tag'

const steps = [
  { label: 'Terreno', icon: MapPin },
  { label: 'Proyecto', icon: Building2 },
  { label: 'Economía', icon: Calculator },
  { label: 'Comparables', icon: BarChart3 },
  { label: 'Conclusión', icon: FileText },
]

interface UnitMix { type: string; count: string; avg_m2: string }
interface Comparable { project: string; price_per_m2: string; notes: string }
interface TimelinePhase { phase: string; months: string }

export default function NuevaPrefactibilidadPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)

  // Terreno
  const [address, setAddress] = useState('')
  const [neighborhood, setNeighborhood] = useState('')
  const [lotArea, setLotArea] = useState('')
  const [lotFrontage, setLotFrontage] = useState('')
  const [lotDepth, setLotDepth] = useState('')
  const [zoning, setZoning] = useState('')
  const [fot, setFot] = useState('')
  const [fos, setFos] = useState('')
  const [maxHeight, setMaxHeight] = useState('')
  const [lotPrice, setLotPrice] = useState('')
  const [lotDescription, setLotDescription] = useState('')

  // Proyecto
  const [projectName, setProjectName] = useState('')
  const [projectDescription, setProjectDescription] = useState('')
  const [buildableArea, setBuildableArea] = useState('')
  const [totalUnits, setTotalUnits] = useState('')
  const [unitsMix, setUnitsMix] = useState<UnitMix[]>([{ type: 'Monoambiente', count: '', avg_m2: '' }])
  const [parkingSpots, setParkingSpots] = useState('')
  const [amenities, setAmenities] = useState<string[]>([])
  const [newAmenity, setNewAmenity] = useState('')

  // Economía
  const [constructionCostPerM2, setConstructionCostPerM2] = useState('')
  const [professionalFees, setProfessionalFees] = useState('')
  const [permitsCost, setPermitsCost] = useState('')
  const [commercializationCost, setCommercializationCost] = useState('')
  const [otherCosts, setOtherCosts] = useState('')
  const [avgSalePricePerM2, setAvgSalePricePerM2] = useState('')
  const [totalSellableArea, setTotalSellableArea] = useState('')

  // Comparables
  const [comparables, setComparables] = useState<Comparable[]>([{ project: '', price_per_m2: '', notes: '' }])

  // Timeline
  const [timeline, setTimeline] = useState<TimelinePhase[]>([
    { phase: 'Permisos y proyecto', months: '6' },
    { phase: 'Construcción', months: '18' },
    { phase: 'Comercialización', months: '12' },
    { phase: 'Entrega', months: '3' },
  ])

  // Conclusión
  const [executiveSummary, setExecutiveSummary] = useState('')
  const [recommendation, setRecommendation] = useState('')

  // Calculated values
  const lotPricePerM2 = lotArea && lotPrice ? Number(lotPrice) / Number(lotArea) : 0
  const totalConstructionCost = buildableArea && constructionCostPerM2
    ? Number(buildableArea) * Number(constructionCostPerM2) : 0
  const totalInvestment = (Number(lotPrice) || 0) + totalConstructionCost +
    (Number(professionalFees) || 0) + (Number(permitsCost) || 0) +
    (Number(commercializationCost) || 0) + (Number(otherCosts) || 0)
  const projectedRevenue = totalSellableArea && avgSalePricePerM2
    ? Number(totalSellableArea) * Number(avgSalePricePerM2) : 0
  const grossMargin = projectedRevenue - totalInvestment
  const marginPct = totalInvestment > 0 ? (grossMargin / totalInvestment) * 100 : 0

  async function handleSave(publish = false) {
    if (!address.trim()) { toast('La dirección es requerida', 'error'); return }
    setSaving(true)
    try {
      const res = await apiFetch('properties', '/prefactibilidades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address, neighborhood,
          lot_area: lotArea, lot_frontage: lotFrontage, lot_depth: lotDepth,
          zoning, fot, fos, max_height: maxHeight, lot_price: lotPrice,
          lot_price_per_m2: lotPricePerM2, lot_description: lotDescription,
          project_name: projectName, project_description: projectDescription,
          buildable_area: buildableArea, total_units: totalUnits,
          units_mix: unitsMix.filter(u => u.type && u.count),
          parking_spots: parkingSpots, amenities,
          construction_cost_per_m2: constructionCostPerM2,
          total_construction_cost: totalConstructionCost,
          professional_fees: professionalFees, permits_cost: permitsCost,
          commercialization_cost: commercializationCost, other_costs: otherCosts,
          total_investment: totalInvestment,
          avg_sale_price_per_m2: avgSalePricePerM2,
          total_sellable_area: totalSellableArea,
          projected_revenue: projectedRevenue,
          gross_margin: grossMargin, margin_pct: marginPct,
          comparables: comparables.filter(c => c.project),
          timeline: timeline.filter(t => t.phase),
          executive_summary: executiveSummary,
          recommendation,
        }),
      })
      const data = (await res.json()) as any
      if (data.slug) {
        toast('Prefactibilidad guardada')
        router.push(publish ? `/p/${data.slug}` : '/tasaciones')
      } else {
        toast(data.error || 'Error al guardar', 'error')
      }
    } catch { toast('Error de conexión', 'error') }
    setSaving(false)
  }

  return (
    <div>
      <Link href="/tasaciones" className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-gray-600 mb-4">
        <ArrowLeft className="w-4 h-4" /> Volver
      </Link>

      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-pink to-brand-orange flex items-center justify-center">
          <BarChart3 className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-ink">Estudio de Prefactibilidad</h1>
          <p className="text-xs text-gray-400">Análisis de viabilidad para lotes e inversores · Paso {step + 1} de {steps.length}</p>
        </div>
      </div>

      {/* Steps nav */}
      {/* ds-todo: candidato a variante "Stepper" (pills de pasos con ícono; SegmentedControl no soporta íconos) */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {steps.map((s, i) => {
          const Icon = s.icon
          return (
            <button
              key={i}
              onClick={() => setStep(i)}
              className={`flex items-center gap-2 px-3 py-2 rounded-control text-xs font-medium whitespace-nowrap ${
                step === i ? 'bg-primary text-white' : 'bg-white text-gray-500 border border-gray-200'
              }`}
            >
              <Icon className="w-3.5 h-3.5" /> {s.label}
            </button>
          )
        })}
      </div>

      <Card className="p-5 sm:p-6">

        {/* Step 0: Terreno */}
        {step === 0 && (
          <div className="space-y-4">
            <Heading level={4} className="mb-4">Datos del terreno</Heading>
            <Field label="Dirección" required>
              <Input value={address} onChange={e => setAddress(e.target.value)} placeholder="Soler 3317" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Barrio">
                <Input value={neighborhood} onChange={e => setNeighborhood(e.target.value)} placeholder="Palermo" />
              </Field>
              <Field label="Zonificación">
                <Input value={zoning} onChange={e => setZoning(e.target.value)} placeholder="R2bII" />
              </Field>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Superficie (m²)">
                <Input type="number" value={lotArea} onChange={e => setLotArea(e.target.value)} />
              </Field>
              <Field label="Frente (m)">
                <Input type="number" value={lotFrontage} onChange={e => setLotFrontage(e.target.value)} />
              </Field>
              <Field label="Fondo (m)">
                <Input type="number" value={lotDepth} onChange={e => setLotDepth(e.target.value)} />
              </Field>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Field label="FOT">
                <Input type="number" step="0.1" value={fot} onChange={e => setFot(e.target.value)} placeholder="1.2" />
              </Field>
              <Field label="FOS">
                <Input type="number" step="0.1" value={fos} onChange={e => setFos(e.target.value)} placeholder="0.6" />
              </Field>
              <Field label="Altura máx.">
                <Input value={maxHeight} onChange={e => setMaxHeight(e.target.value)} placeholder="15m / 5 pisos" />
              </Field>
            </div>
            <Field label="Precio del terreno (USD)" hint={lotPricePerM2 > 0 ? `USD ${lotPricePerM2.toFixed(0)} / m²` : undefined}>
              <Input type="number" value={lotPrice} onChange={e => setLotPrice(e.target.value)} placeholder="500000" />
            </Field>
            <Field label="Descripción del terreno">
              <Textarea className="h-20" value={lotDescription} onChange={e => setLotDescription(e.target.value)} placeholder="Lote rectangular, ubicación estratégica..." />
            </Field>
          </div>
        )}

        {/* Step 1: Proyecto */}
        {step === 1 && (
          <div className="space-y-4">
            <Heading level={4} className="mb-4">Proyecto propuesto</Heading>
            <Field label="Nombre del proyecto">
              <Input value={projectName} onChange={e => setProjectName(e.target.value)} placeholder="Torre Soler" />
            </Field>
            <Field label="Descripción">
              <Textarea className="h-20" value={projectDescription} onChange={e => setProjectDescription(e.target.value)} placeholder="Edificio residencial de categoría con amenities..." />
            </Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label="M² construibles">
                <Input type="number" value={buildableArea} onChange={e => setBuildableArea(e.target.value)} />
              </Field>
              <Field label="Total unidades">
                <Input type="number" value={totalUnits} onChange={e => setTotalUnits(e.target.value)} />
              </Field>
              <Field label="Cocheras">
                <Input type="number" value={parkingSpots} onChange={e => setParkingSpots(e.target.value)} />
              </Field>
            </div>

            <div>
              <Text as="span" size="sm" weight="medium" className="block text-gray-700 mb-1.5">Mix de tipologías</Text>
              {unitsMix.map((unit, idx) => (
                <div key={idx} className="flex gap-2 mb-2">
                  <Input
                    className="flex-1"
                    value={unit.type}
                    placeholder="Tipo"
                    onChange={e => {
                      const newMix = [...unitsMix]
                      newMix[idx].type = e.target.value
                      setUnitsMix(newMix)
                    }}
                  />
                  <Input
                    className="w-20"
                    type="number"
                    placeholder="Cant"
                    value={unit.count}
                    onChange={e => {
                      const newMix = [...unitsMix]
                      newMix[idx].count = e.target.value
                      setUnitsMix(newMix)
                    }}
                  />
                  <Input
                    className="w-24"
                    type="number"
                    placeholder="m² prom"
                    value={unit.avg_m2}
                    onChange={e => {
                      const newMix = [...unitsMix]
                      newMix[idx].avg_m2 = e.target.value
                      setUnitsMix(newMix)
                    }}
                  />
                  <Button variant="ghost" size="icon" aria-label="Quitar fila" onClick={() => setUnitsMix(unitsMix.filter((_, i) => i !== idx))} className="text-danger hover:bg-danger/10">
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
              <button
                onClick={() => setUnitsMix([...unitsMix, { type: '', count: '', avg_m2: '' }])}
                className="text-sm font-medium text-primary flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> Agregar tipología
              </button>
            </div>

            <div>
              <Text as="span" size="sm" weight="medium" className="block text-gray-700 mb-1.5">Amenities</Text>
              <div className="flex flex-wrap gap-2 mb-2">
                {amenities.map((a, i) => (
                  <Tag key={i} variant="soft" onRemove={() => setAmenities(amenities.filter((_, x) => x !== i))}>
                    {a}
                  </Tag>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  value={newAmenity}
                  onChange={e => setNewAmenity(e.target.value)}
                  placeholder="Ej: Piscina, SUM, Gym..."
                  onKeyDown={e => {
                    if (e.key === 'Enter' && newAmenity.trim()) {
                      setAmenities([...amenities, newAmenity.trim()])
                      setNewAmenity('')
                    }
                  }}
                />
                <Button
                  variant="outline"
                  onClick={() => { if (newAmenity.trim()) { setAmenities([...amenities, newAmenity.trim()]); setNewAmenity('') } }}
                >
                  Agregar
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Economía */}
        {step === 2 && (
          <div className="space-y-4">
            <Heading level={4} className="mb-4">Análisis económico</Heading>
            <Alert tone="warning">Todos los valores en USD</Alert>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Costo construcción USD/m²">
                <Input type="number" value={constructionCostPerM2} onChange={e => setConstructionCostPerM2(e.target.value)} placeholder="1200" />
              </Field>
              <Field label="Total construcción (calc)">
                <div className="bg-gray-50 rounded-control px-3 py-2.5 text-sm font-semibold text-gray-700">
                  USD {totalConstructionCost.toLocaleString('es-AR')}
                </div>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Honorarios profesionales">
                <Input type="number" value={professionalFees} onChange={e => setProfessionalFees(e.target.value)} />
              </Field>
              <Field label="Permisos y factibilidad">
                <Input type="number" value={permitsCost} onChange={e => setPermitsCost(e.target.value)} />
              </Field>
              <Field label="Comercialización">
                <Input type="number" value={commercializationCost} onChange={e => setCommercializationCost(e.target.value)} />
              </Field>
              <Field label="Otros costos">
                <Input type="number" value={otherCosts} onChange={e => setOtherCosts(e.target.value)} />
              </Field>
            </div>

            <StatTile label="Inversión total" value={`USD ${totalInvestment.toLocaleString('es-AR')}`} />

            <Heading level={4} className="mt-6">Ingresos proyectados</Heading>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Precio venta USD/m²">
                <Input type="number" value={avgSalePricePerM2} onChange={e => setAvgSalePricePerM2(e.target.value)} placeholder="2800" />
              </Field>
              <Field label="M² vendibles">
                <Input type="number" value={totalSellableArea} onChange={e => setTotalSellableArea(e.target.value)} />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <StatTile tone="success" label="Ingresos proyectados" value={`USD ${projectedRevenue.toLocaleString('es-AR')}`} />
              <StatTile
                tone={grossMargin > 0 ? 'primary' : 'danger'}
                label="Margen bruto"
                value={`USD ${grossMargin.toLocaleString('es-AR')}`}
                caption={`${marginPct.toFixed(1)}% ROI`}
              />
            </div>
          </div>
        )}

        {/* Step 3: Comparables */}
        {step === 3 && (
          <div className="space-y-4">
            <Heading level={4} className="mb-4">Comparables de la zona</Heading>
            {comparables.map((c, idx) => (
              <div key={idx} className="border border-gray-200 rounded-card p-3 space-y-2">
                <div className="flex justify-between items-center">
                  <Text as="span" size="xs" weight="semibold" tone="muted">Comparable #{idx + 1}</Text>
                  <button onClick={() => setComparables(comparables.filter((_, i) => i !== idx))} className="text-danger">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <Input
                  placeholder="Nombre del proyecto/dirección"
                  value={c.project}
                  onChange={e => {
                    const nc = [...comparables]
                    nc[idx].project = e.target.value
                    setComparables(nc)
                  }}
                />
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    type="number"
                    placeholder="USD/m²"
                    value={c.price_per_m2}
                    onChange={e => {
                      const nc = [...comparables]
                      nc[idx].price_per_m2 = e.target.value
                      setComparables(nc)
                    }}
                  />
                  <Input
                    placeholder="Notas"
                    value={c.notes}
                    onChange={e => {
                      const nc = [...comparables]
                      nc[idx].notes = e.target.value
                      setComparables(nc)
                    }}
                  />
                </div>
              </div>
            ))}
            <button
              onClick={() => setComparables([...comparables, { project: '', price_per_m2: '', notes: '' }])}
              className="text-sm font-medium text-primary flex items-center gap-1"
            >
              <Plus className="w-3 h-3" /> Agregar comparable
            </button>

            <Heading level={4} className="mt-6">Cronograma del proyecto</Heading>
            {timeline.map((t, idx) => (
              <div key={idx} className="flex gap-2">
                <Input
                  className="flex-1"
                  placeholder="Fase"
                  value={t.phase}
                  onChange={e => {
                    const nt = [...timeline]
                    nt[idx].phase = e.target.value
                    setTimeline(nt)
                  }}
                />
                <Input
                  className="w-24"
                  type="number"
                  placeholder="meses"
                  value={t.months}
                  onChange={e => {
                    const nt = [...timeline]
                    nt[idx].months = e.target.value
                    setTimeline(nt)
                  }}
                />
                <button onClick={() => setTimeline(timeline.filter((_, i) => i !== idx))} className="text-danger p-2">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
            <button
              onClick={() => setTimeline([...timeline, { phase: '', months: '' }])}
              className="text-sm font-medium text-primary flex items-center gap-1"
            >
              <Plus className="w-3 h-3" /> Agregar fase
            </button>
          </div>
        )}

        {/* Step 4: Conclusión */}
        {step === 4 && (
          <div className="space-y-4">
            <Heading level={4} className="mb-4">Conclusión</Heading>
            <Field label="Resumen ejecutivo">
              <Textarea
                className="h-32"
                value={executiveSummary}
                onChange={e => setExecutiveSummary(e.target.value)}
                placeholder="El proyecto contempla el desarrollo de un edificio residencial..."
              />
            </Field>
            <Field label="Recomendación">
              <Textarea
                className="h-24"
                value={recommendation}
                onChange={e => setRecommendation(e.target.value)}
                placeholder="Se recomienda avanzar con la operación dado que..."
              />
            </Field>

            {/* Summary */}
            <div className="bg-gradient-to-br from-primary/5 to-brand-orange/10 rounded-card p-5 border border-primary/10">
              <Heading level={4} className="mb-3">Resumen del estudio</Heading>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-gray-500">Inversión total:</span> <strong>USD {totalInvestment.toLocaleString('es-AR')}</strong></div>
                <div><span className="text-gray-500">Ingresos proyectados:</span> <strong>USD {projectedRevenue.toLocaleString('es-AR')}</strong></div>
                <div><span className="text-gray-500">Margen:</span> <strong>USD {grossMargin.toLocaleString('es-AR')}</strong></div>
                <div><span className="text-gray-500">ROI:</span> <strong>{marginPct.toFixed(1)}%</strong></div>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Nav footer */}
      <div className="flex justify-between mt-4">
        <Button
          variant="ghost"
          onClick={() => setStep(s => Math.max(0, s - 1))}
          disabled={step === 0}
          icon={<ArrowLeft className="w-4 h-4" />}
        >
          Anterior
        </Button>
        {step < steps.length - 1 ? (
          <Button
            size="lg"
            onClick={() => setStep(s => Math.min(steps.length - 1, s + 1))}
          >
            Siguiente <ArrowRight className="w-4 h-4" />
          </Button>
        ) : (
          <Button
            size="lg"
            onClick={() => handleSave(true)}
            disabled={!address.trim()}
            loading={saving}
            icon={<Save className="w-4 h-4" />}
          >
            Guardar y publicar
          </Button>
        )}
      </div>
    </div>
  )
}
