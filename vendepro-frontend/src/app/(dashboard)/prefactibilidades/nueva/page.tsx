'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, ArrowRight, Save, Loader2, MapPin, Building2,
  Calculator, BarChart3, FileText, Plus, X
} from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'

const steps = [
  { label: 'Terreno', icon: MapPin },
  { label: 'Proyecto', icon: Building2 },
  { label: 'Economía', icon: Calculator },
  { label: 'Comparables', icon: BarChart3 },
  { label: 'Conclusión', icon: FileText },
]

const inputClass = 'w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#ff007c]/30 focus:border-[#ff007c] outline-none bg-white'
const labelClass = 'block text-xs font-medium text-gray-500 mb-1'

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
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#ff007c] to-[#ff8017] flex items-center justify-center">
          <BarChart3 className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-800">Estudio de Prefactibilidad</h1>
          <p className="text-xs text-gray-400">Análisis de viabilidad para lotes e inversores · Paso {step + 1} de {steps.length}</p>
        </div>
      </div>

      {/* Steps nav */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {steps.map((s, i) => {
          const Icon = s.icon
          return (
            <button
              key={i}
              onClick={() => setStep(i)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap ${
                step === i ? 'bg-[#ff007c] text-white' : 'bg-white text-gray-500 border border-gray-200'
              }`}
            >
              <Icon className="w-3.5 h-3.5" /> {s.label}
            </button>
          )
        })}
      </div>

      <div className="bg-white rounded-xl shadow-sm p-5 sm:p-6">

        {/* Step 0: Terreno */}
        {step === 0 && (
          <div className="space-y-4">
            <h2 className="font-bold text-gray-800 mb-4">Datos del terreno</h2>
            <div>
              <label className={labelClass}>Dirección *</label>
              <input className={inputClass} value={address} onChange={e => setAddress(e.target.value)} placeholder="Soler 3317" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Barrio</label>
                <input className={inputClass} value={neighborhood} onChange={e => setNeighborhood(e.target.value)} placeholder="Palermo" />
              </div>
              <div>
                <label className={labelClass}>Zonificación</label>
                <input className={inputClass} value={zoning} onChange={e => setZoning(e.target.value)} placeholder="R2bII" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={labelClass}>Superficie (m²)</label>
                <input className={inputClass} type="number" value={lotArea} onChange={e => setLotArea(e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>Frente (m)</label>
                <input className={inputClass} type="number" value={lotFrontage} onChange={e => setLotFrontage(e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>Fondo (m)</label>
                <input className={inputClass} type="number" value={lotDepth} onChange={e => setLotDepth(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={labelClass}>FOT</label>
                <input className={inputClass} type="number" step="0.1" value={fot} onChange={e => setFot(e.target.value)} placeholder="1.2" />
              </div>
              <div>
                <label className={labelClass}>FOS</label>
                <input className={inputClass} type="number" step="0.1" value={fos} onChange={e => setFos(e.target.value)} placeholder="0.6" />
              </div>
              <div>
                <label className={labelClass}>Altura máx.</label>
                <input className={inputClass} value={maxHeight} onChange={e => setMaxHeight(e.target.value)} placeholder="15m / 5 pisos" />
              </div>
            </div>
            <div>
              <label className={labelClass}>Precio del terreno (USD)</label>
              <input className={inputClass} type="number" value={lotPrice} onChange={e => setLotPrice(e.target.value)} placeholder="500000" />
              {lotPricePerM2 > 0 && <p className="text-xs text-gray-400 mt-1">USD {lotPricePerM2.toFixed(0)} / m²</p>}
            </div>
            <div>
              <label className={labelClass}>Descripción del terreno</label>
              <textarea className={`${inputClass} h-20`} value={lotDescription} onChange={e => setLotDescription(e.target.value)} placeholder="Lote rectangular, ubicación estratégica..." />
            </div>
          </div>
        )}

        {/* Step 1: Proyecto */}
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="font-bold text-gray-800 mb-4">Proyecto propuesto</h2>
            <div>
              <label className={labelClass}>Nombre del proyecto</label>
              <input className={inputClass} value={projectName} onChange={e => setProjectName(e.target.value)} placeholder="Torre Soler" />
            </div>
            <div>
              <label className={labelClass}>Descripción</label>
              <textarea className={`${inputClass} h-20`} value={projectDescription} onChange={e => setProjectDescription(e.target.value)} placeholder="Edificio residencial de categoría con amenities..." />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={labelClass}>M² construibles</label>
                <input className={inputClass} type="number" value={buildableArea} onChange={e => setBuildableArea(e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>Total unidades</label>
                <input className={inputClass} type="number" value={totalUnits} onChange={e => setTotalUnits(e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>Cocheras</label>
                <input className={inputClass} type="number" value={parkingSpots} onChange={e => setParkingSpots(e.target.value)} />
              </div>
            </div>

            <div>
              <label className={labelClass}>Mix de tipologías</label>
              {unitsMix.map((unit, idx) => (
                <div key={idx} className="flex gap-2 mb-2">
                  <input
                    className={`${inputClass} flex-1`}
                    value={unit.type}
                    placeholder="Tipo"
                    onChange={e => {
                      const newMix = [...unitsMix]
                      newMix[idx].type = e.target.value
                      setUnitsMix(newMix)
                    }}
                  />
                  <input
                    className={`${inputClass} w-20`}
                    type="number"
                    placeholder="Cant"
                    value={unit.count}
                    onChange={e => {
                      const newMix = [...unitsMix]
                      newMix[idx].count = e.target.value
                      setUnitsMix(newMix)
                    }}
                  />
                  <input
                    className={`${inputClass} w-24`}
                    type="number"
                    placeholder="m² prom"
                    value={unit.avg_m2}
                    onChange={e => {
                      const newMix = [...unitsMix]
                      newMix[idx].avg_m2 = e.target.value
                      setUnitsMix(newMix)
                    }}
                  />
                  <button onClick={() => setUnitsMix(unitsMix.filter((_, i) => i !== idx))} className="text-red-400 p-2">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <button
                onClick={() => setUnitsMix([...unitsMix, { type: '', count: '', avg_m2: '' }])}
                className="text-xs text-[#ff007c] flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> Agregar tipología
              </button>
            </div>

            <div>
              <label className={labelClass}>Amenities</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {amenities.map((a, i) => (
                  <span key={i} className="inline-flex items-center gap-1 bg-pink-50 text-[#ff007c] px-3 py-1 rounded-full text-xs">
                    {a}
                    <button onClick={() => setAmenities(amenities.filter((_, x) => x !== i))}>
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  className={inputClass}
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
                <button
                  onClick={() => { if (newAmenity.trim()) { setAmenities([...amenities, newAmenity.trim()]); setNewAmenity('') } }}
                  className="bg-gray-100 px-4 rounded-lg text-sm"
                >
                  Agregar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Economía */}
        {step === 2 && (
          <div className="space-y-4">
            <h2 className="font-bold text-gray-800 mb-4">Análisis económico</h2>
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-xs text-orange-700">
              Todos los valores en USD
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Costo construcción USD/m²</label>
                <input className={inputClass} type="number" value={constructionCostPerM2} onChange={e => setConstructionCostPerM2(e.target.value)} placeholder="1200" />
              </div>
              <div>
                <label className={labelClass}>Total construcción (calc)</label>
                <div className="bg-gray-50 rounded-lg px-3 py-2.5 text-sm font-semibold text-gray-700">
                  USD {totalConstructionCost.toLocaleString('es-AR')}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Honorarios profesionales</label>
                <input className={inputClass} type="number" value={professionalFees} onChange={e => setProfessionalFees(e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>Permisos y factibilidad</label>
                <input className={inputClass} type="number" value={permitsCost} onChange={e => setPermitsCost(e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>Comercialización</label>
                <input className={inputClass} type="number" value={commercializationCost} onChange={e => setCommercializationCost(e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>Otros costos</label>
                <input className={inputClass} type="number" value={otherCosts} onChange={e => setOtherCosts(e.target.value)} />
              </div>
            </div>

            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-xs text-gray-500 mb-1">Inversión total</p>
              <p className="text-2xl font-black text-gray-800">USD {totalInvestment.toLocaleString('es-AR')}</p>
            </div>

            <h3 className="font-semibold text-gray-700 text-sm mt-6">Ingresos proyectados</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Precio venta USD/m²</label>
                <input className={inputClass} type="number" value={avgSalePricePerM2} onChange={e => setAvgSalePricePerM2(e.target.value)} placeholder="2800" />
              </div>
              <div>
                <label className={labelClass}>M² vendibles</label>
                <input className={inputClass} type="number" value={totalSellableArea} onChange={e => setTotalSellableArea(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-green-50 rounded-xl p-4">
                <p className="text-xs text-green-600 mb-1">Ingresos proyectados</p>
                <p className="text-xl font-black text-green-700">USD {projectedRevenue.toLocaleString('es-AR')}</p>
              </div>
              <div className={`rounded-xl p-4 ${grossMargin > 0 ? 'bg-pink-50' : 'bg-red-50'}`}>
                <p className={`text-xs mb-1 ${grossMargin > 0 ? 'text-[#ff007c]' : 'text-red-600'}`}>Margen bruto</p>
                <p className={`text-xl font-black ${grossMargin > 0 ? 'text-[#ff007c]' : 'text-red-700'}`}>
                  USD {grossMargin.toLocaleString('es-AR')}
                </p>
                <p className={`text-xs mt-1 ${grossMargin > 0 ? 'text-[#ff007c]' : 'text-red-600'}`}>
                  {marginPct.toFixed(1)}% ROI
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Comparables */}
        {step === 3 && (
          <div className="space-y-4">
            <h2 className="font-bold text-gray-800 mb-4">Comparables de la zona</h2>
            {comparables.map((c, idx) => (
              <div key={idx} className="border border-gray-200 rounded-lg p-3 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold text-gray-500">Comparable #{idx + 1}</span>
                  <button onClick={() => setComparables(comparables.filter((_, i) => i !== idx))} className="text-red-400">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <input
                  className={inputClass}
                  placeholder="Nombre del proyecto/dirección"
                  value={c.project}
                  onChange={e => {
                    const nc = [...comparables]
                    nc[idx].project = e.target.value
                    setComparables(nc)
                  }}
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    className={inputClass}
                    type="number"
                    placeholder="USD/m²"
                    value={c.price_per_m2}
                    onChange={e => {
                      const nc = [...comparables]
                      nc[idx].price_per_m2 = e.target.value
                      setComparables(nc)
                    }}
                  />
                  <input
                    className={inputClass}
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
              className="text-xs text-[#ff007c] flex items-center gap-1"
            >
              <Plus className="w-3 h-3" /> Agregar comparable
            </button>

            <h3 className="font-semibold text-gray-700 text-sm mt-6">Cronograma del proyecto</h3>
            {timeline.map((t, idx) => (
              <div key={idx} className="flex gap-2">
                <input
                  className={`${inputClass} flex-1`}
                  placeholder="Fase"
                  value={t.phase}
                  onChange={e => {
                    const nt = [...timeline]
                    nt[idx].phase = e.target.value
                    setTimeline(nt)
                  }}
                />
                <input
                  className={`${inputClass} w-24`}
                  type="number"
                  placeholder="meses"
                  value={t.months}
                  onChange={e => {
                    const nt = [...timeline]
                    nt[idx].months = e.target.value
                    setTimeline(nt)
                  }}
                />
                <button onClick={() => setTimeline(timeline.filter((_, i) => i !== idx))} className="text-red-400 p-2">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
            <button
              onClick={() => setTimeline([...timeline, { phase: '', months: '' }])}
              className="text-xs text-[#ff007c] flex items-center gap-1"
            >
              <Plus className="w-3 h-3" /> Agregar fase
            </button>
          </div>
        )}

        {/* Step 4: Conclusión */}
        {step === 4 && (
          <div className="space-y-4">
            <h2 className="font-bold text-gray-800 mb-4">Conclusión</h2>
            <div>
              <label className={labelClass}>Resumen ejecutivo</label>
              <textarea
                className={`${inputClass} h-32`}
                value={executiveSummary}
                onChange={e => setExecutiveSummary(e.target.value)}
                placeholder="El proyecto contempla el desarrollo de un edificio residencial..."
              />
            </div>
            <div>
              <label className={labelClass}>Recomendación</label>
              <textarea
                className={`${inputClass} h-24`}
                value={recommendation}
                onChange={e => setRecommendation(e.target.value)}
                placeholder="Se recomienda avanzar con la operación dado que..."
              />
            </div>

            {/* Summary */}
            <div className="bg-gradient-to-br from-pink-50 to-orange-50 rounded-xl p-5 border border-pink-100">
              <h3 className="font-bold text-gray-800 mb-3">Resumen del estudio</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-gray-500">Inversión total:</span> <strong>USD {totalInvestment.toLocaleString('es-AR')}</strong></div>
                <div><span className="text-gray-500">Ingresos proyectados:</span> <strong>USD {projectedRevenue.toLocaleString('es-AR')}</strong></div>
                <div><span className="text-gray-500">Margen:</span> <strong>USD {grossMargin.toLocaleString('es-AR')}</strong></div>
                <div><span className="text-gray-500">ROI:</span> <strong>{marginPct.toFixed(1)}%</strong></div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Nav footer */}
      <div className="flex justify-between mt-4">
        <button
          onClick={() => setStep(s => Math.max(0, s - 1))}
          disabled={step === 0}
          className="inline-flex items-center gap-2 px-4 py-2 text-gray-500 disabled:opacity-30 text-sm"
        >
          <ArrowLeft className="w-4 h-4" /> Anterior
        </button>
        {step < steps.length - 1 ? (
          <button
            onClick={() => setStep(s => Math.min(steps.length - 1, s + 1))}
            className="inline-flex items-center gap-2 bg-[#ff007c] text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:opacity-90"
          >
            Siguiente <ArrowRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={() => handleSave(true)}
            disabled={saving || !address.trim()}
            className="inline-flex items-center gap-2 bg-gradient-to-r from-[#ff007c] to-[#ff8017] text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Guardar y publicar
          </button>
        )}
      </div>
    </div>
  )
}
