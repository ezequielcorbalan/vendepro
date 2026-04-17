'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import {
  ArrowLeft, ArrowRight, Home, Shield, Search, DollarSign, Eye,
  Plus, Trash2, Loader2, MapPin, CheckCircle, Clipboard
} from 'lucide-react'
import Link from 'next/link'
import { apiFetch } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'

interface Comparable {
  zonaprop_url: string
  address: string
  total_area: string
  covered_area: string
  price: string
  usd_per_m2: string
  days_on_market: string
  views_per_day: string
  age: string
  loading?: boolean
}

const emptyComparable = (): Comparable => ({
  zonaprop_url: '', address: '', total_area: '', covered_area: '',
  price: '', usd_per_m2: '', days_on_market: '', views_per_day: '', age: ''
})

const steps = [
  { label: 'Propiedad', icon: Home },
  { label: 'FODA', icon: Shield },
  { label: 'Competencia', icon: Search },
  { label: 'Tasación', icon: DollarSign },
  { label: 'Guardar', icon: Eye },
]

export default function EditarTasacionPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const { toast } = useToast()
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  const [address, setAddress] = useState('')
  const [neighborhood, setNeighborhood] = useState('')
  const [city, setCity] = useState('Buenos Aires')
  const [propertyType, setPropertyType] = useState('departamento')
  const [coveredArea, setCoveredArea] = useState('')
  const [totalArea, setTotalArea] = useState('')
  const [semiArea, setSemiArea] = useState('')
  const [pctCubierta, setPctCubierta] = useState('100')
  const [pctSemi, setPctSemi] = useState('75')
  const [pctDesc, setPctDesc] = useState('25')
  const [propertyAge, setPropertyAge] = useState('')

  const [strengths, setStrengths] = useState('')
  const [weaknesses, setWeaknesses] = useState('')
  const [opportunities, setOpportunities] = useState('')
  const [threats, setThreats] = useState('')
  const [pubAnalysis, setPubAnalysis] = useState('')

  const [comparables, setComparables] = useState<Comparable[]>([emptyComparable()])
  const [pastedImages, setPastedImages] = useState<Record<number, string[]>>({})

  const [suggestedPrice, setSuggestedPrice] = useState('')
  const [testPrice, setTestPrice] = useState('')
  const [expectedClose, setExpectedClose] = useState('')
  const [agentNotes, setAgentNotes] = useState('')
  const [videoTasacionUrl, setVideoTasacionUrl] = useState('')
  const [zoneAvgPrice, setZoneAvgPrice] = useState('')
  const [zoneAvgM2, setZoneAvgM2] = useState('')
  const [zoneAvgUsdM2, setZoneAvgUsdM2] = useState('')

  useEffect(() => {
    async function load() {
      try {
        const res = await apiFetch('properties', `/appraisals?id=${id}`)
        const data = (await res.json()) as any
        if (data.error || !data.id) { router.push('/tasaciones'); return }

        setAddress(data.property_address || '')
        setNeighborhood(data.neighborhood || '')
        setCity(data.city || 'Buenos Aires')
        setPropertyType(data.property_type || 'departamento')
        setCoveredArea(data.covered_area?.toString() || '')
        setTotalArea(data.total_area?.toString() || '')
        setSemiArea(data.semi_area?.toString() || '')
        setStrengths(data.strengths || '')
        setWeaknesses(data.weaknesses || '')
        setOpportunities(data.opportunities || '')
        setThreats(data.threats || '')
        setPubAnalysis(data.publication_analysis || '')
        setSuggestedPrice(data.suggested_price?.toString() || '')
        setTestPrice(data.test_price?.toString() || '')
        setExpectedClose(data.expected_close_price?.toString() || '')
        setAgentNotes(data.agent_notes || '')
        setVideoTasacionUrl(data.video_tasacion_url || '')
        setZoneAvgPrice(data.zone_avg_price?.toString() || '')
        setZoneAvgM2(data.zone_avg_m2?.toString() || '')
        setZoneAvgUsdM2(data.zone_avg_usd_m2?.toString() || '')

        if (data.comparables?.length > 0) {
          setComparables(data.comparables.map((c: any) => ({
            zonaprop_url: c.zonaprop_url || '',
            address: c.address || '',
            total_area: c.total_area?.toString() || '',
            covered_area: c.covered_area?.toString() || '',
            price: c.price?.toString() || '',
            usd_per_m2: c.usd_per_m2?.toString() || '',
            days_on_market: c.days_on_market?.toString() || '',
            views_per_day: c.views_per_day?.toString() || '',
            age: c.age?.toString() || '',
          })))
        }
      } catch { router.push('/tasaciones') }
      setLoading(false)
    }
    load()
  }, [id, router])

  const descArea = Math.max(0, (parseFloat(totalArea) || 0) - (parseFloat(coveredArea) || 0) - (parseFloat(semiArea) || 0))
  const weightedArea = (parseFloat(coveredArea) || 0) * ((parseFloat(pctCubierta) || 0) / 100)
    + (parseFloat(semiArea) || 0) * ((parseFloat(pctSemi) || 0) / 100)
    + descArea * ((parseFloat(pctDesc) || 0) / 100)
  const avgUsdM2 = (() => {
    const prices = comparables.filter(c => parseFloat(c.usd_per_m2) > 0).map(c => parseFloat(c.usd_per_m2))
    return prices.length > 0 ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : 0
  })()

  async function extractFromImage(index: number, file: File) {
    const updated = [...comparables]
    updated[index] = { ...updated[index], loading: true }
    setComparables(updated)
    const reader = new FileReader()
    reader.onload = (e) => {
      setPastedImages(prev => ({ ...prev, [index]: [...(prev[index] || []), e.target?.result as string] }))
    }
    reader.readAsDataURL(file)
    try {
      const formData = new FormData()
      formData.append('screenshot', file)
      const res = await apiFetch('ai', '/extract-zonaprop', { method: 'POST', body: formData })
      const data = (await res.json()) as any
      if (data.success) {
        const curr = comparables[index]
        const final = [...comparables]
        final[index] = {
          ...curr,
          address: (data.data.address && data.data.address !== 'null') ? data.data.address : curr.address,
          total_area: data.data.total_area ? data.data.total_area.toString() : curr.total_area,
          covered_area: data.data.covered_area ? data.data.covered_area.toString() : curr.covered_area,
          price: data.data.price ? data.data.price.toString() : curr.price,
          usd_per_m2: data.data.usd_per_m2 ? data.data.usd_per_m2.toString() : curr.usd_per_m2,
          days_on_market: data.data.days_on_market ? data.data.days_on_market.toString() : curr.days_on_market,
          views_per_day: data.data.views_per_day ? data.data.views_per_day.toString() : curr.views_per_day,
          age: data.data.age ? data.data.age.toString() : curr.age,
          loading: false,
        }
        setComparables(final)
      } else {
        const final = [...comparables]
        final[index] = { ...final[index], loading: false }
        setComparables(final)
        toast('No se pudieron extraer datos. Cargalos manualmente.', 'error')
      }
    } catch {
      const final = [...comparables]
      final[index] = { ...final[index], loading: false }
      setComparables(final)
    }
  }

  function handlePaste(index: number, e: React.ClipboardEvent) {
    const items = e.clipboardData?.items
    if (!items) return
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        e.preventDefault()
        const file = items[i].getAsFile()
        if (file) extractFromImage(index, file)
        return
      }
    }
  }

  function addComparable() { if (comparables.length < 6) setComparables([...comparables, emptyComparable()]) }
  function removeComparable(i: number) { if (comparables.length > 1) setComparables(comparables.filter((_, idx) => idx !== i)) }
  function updateComparable(i: number, field: keyof Comparable, value: string) {
    const updated = [...comparables]
    updated[i] = { ...updated[i], [field]: value }
    if ((field === 'price' || field === 'total_area') && updated[i].price && updated[i].total_area) {
      const p = parseFloat(updated[i].price)
      const ar = parseFloat(updated[i].total_area)
      if (p > 0 && ar > 0) updated[i].usd_per_m2 = Math.round(p / ar).toString()
    }
    setComparables(updated)
  }

  async function handleSubmit() {
    setSaving(true)
    try {
      const res = await apiFetch('properties', '/appraisals', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id, address, neighborhood, city, property_type: propertyType,
          covered_area: parseFloat(coveredArea) || null,
          total_area: parseFloat(totalArea) || null,
          semi_area: parseFloat(semiArea) || null,
          weighted_area: weightedArea > 0 ? weightedArea : null,
          strengths, weaknesses, opportunities, threats,
          publication_analysis: pubAnalysis,
          suggested_price: parseFloat(suggestedPrice) || null,
          test_price: parseFloat(testPrice) || null,
          expected_close_price: parseFloat(expectedClose) || null,
          usd_per_m2: avgUsdM2 || null,
          agent_notes: agentNotes,
          video_tasacion_url: videoTasacionUrl || null,
          zone_avg_price: parseFloat(zoneAvgPrice) || null,
          zone_avg_m2: parseFloat(zoneAvgM2) || null,
          zone_avg_usd_m2: parseFloat(zoneAvgUsdM2) || null,
          comparables: comparables.filter(c => c.zonaprop_url || c.address).map((c, i) => ({
            ...c,
            total_area: parseFloat(c.total_area) || null,
            covered_area: parseFloat(c.covered_area) || null,
            price: parseFloat(c.price) || null,
            usd_per_m2: parseFloat(c.usd_per_m2) || null,
            days_on_market: parseInt(c.days_on_market) || null,
            views_per_day: parseFloat(c.views_per_day) || null,
            age: parseInt(c.age) || null,
            sort_order: i,
          })),
        }),
      })
      const data = (await res.json()) as any
      if (data.success) {
        toast('Tasación guardada')
        router.push(`/tasaciones/${id}`)
      } else {
        toast(data.error || 'Error al guardar', 'error')
      }
    } catch { toast('Error de conexión', 'error') }
    setSaving(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-[#ff007c]" />
      </div>
    )
  }

  const inputClass = 'w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#ff007c]/20 focus:border-[#ff007c] outline-none'
  const labelClass = 'block text-sm font-medium text-gray-700 mb-1'

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/tasaciones/${id}`} className="p-2 rounded-lg hover:bg-gray-100">
          <ArrowLeft className="w-5 h-5 text-gray-500" />
        </Link>
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-800">Editar tasación</h1>
          <p className="text-gray-500 text-sm">{address} — Paso {step + 1} de {steps.length}</p>
        </div>
      </div>

      {/* Step tabs */}
      <div className="flex gap-1 sm:gap-2 mb-6 overflow-x-auto pb-2">
        {steps.map((s, i) => {
          const Icon = s.icon
          return (
            <button key={i} onClick={() => setStep(i)}
              className={`flex items-center gap-1.5 px-2.5 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap transition-colors ${
                i === step
                  ? 'bg-[#ff007c] text-white'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200 cursor-pointer'
              }`}>
              <Icon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{s.label}</span>
            </button>
          )
        })}
      </div>

      <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6">

        {/* STEP 0: Propiedad */}
        {step === 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Datos de la propiedad</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className={labelClass}>Dirección *</label>
                <input className={inputClass} value={address} onChange={e => setAddress(e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>Barrio *</label>
                <input className={inputClass} value={neighborhood} onChange={e => setNeighborhood(e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>Ciudad</label>
                <input className={inputClass} value={city} onChange={e => setCity(e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>Tipología</label>
                <select className={inputClass} value={propertyType} onChange={e => setPropertyType(e.target.value)}>
                  <option value="departamento">Departamento</option>
                  <option value="casa">Casa</option>
                  <option value="ph">PH</option>
                  <option value="local">Local</option>
                  <option value="terreno">Terreno</option>
                  <option value="oficina">Oficina</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Antigüedad</label>
                <input className={inputClass} type="number" value={propertyAge} onChange={e => setPropertyAge(e.target.value)} />
              </div>
            </div>

            <div className="border-t border-gray-100 pt-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Superficies (m²)</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className={labelClass}>Cubierta</label>
                  <input className={inputClass} type="number" value={coveredArea} onChange={e => setCoveredArea(e.target.value)} />
                </div>
                <div>
                  <label className={labelClass}>Total</label>
                  <input className={inputClass} type="number" value={totalArea} onChange={e => setTotalArea(e.target.value)} />
                </div>
                <div>
                  <label className={labelClass}>Semi</label>
                  <input className={inputClass} type="number" value={semiArea} onChange={e => setSemiArea(e.target.value)} />
                </div>
                <div>
                  <label className={labelClass}>Ponderada</label>
                  <div className="bg-[#ff007c]/5 border border-[#ff007c]/20 rounded-lg px-3 py-2.5 text-sm font-semibold text-[#ff007c]">
                    {weightedArea.toFixed(1)} m²
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 mt-3">
                <div>
                  <label className="text-[10px] text-gray-500">% Cubierta</label>
                  <input className={inputClass} type="number" value={pctCubierta} onChange={e => setPctCubierta(e.target.value)} />
                </div>
                <div>
                  <label className="text-[10px] text-gray-500">% Semi</label>
                  <input className={inputClass} type="number" value={pctSemi} onChange={e => setPctSemi(e.target.value)} />
                </div>
                <div>
                  <label className="text-[10px] text-gray-500">% Descubierta</label>
                  <input className={inputClass} type="number" value={pctDesc} onChange={e => setPctDesc(e.target.value)} />
                </div>
              </div>
            </div>

            <div className="border-t border-gray-100 pt-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Valores promedio de la zona</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className={labelClass}>Precio prom. USD</label>
                  <input className={inputClass} type="number" value={zoneAvgPrice} onChange={e => setZoneAvgPrice(e.target.value)} />
                </div>
                <div>
                  <label className={labelClass}>m² promedio</label>
                  <input className={inputClass} type="number" value={zoneAvgM2} onChange={e => setZoneAvgM2(e.target.value)} />
                </div>
                <div>
                  <label className={labelClass}>USD/m² prom.</label>
                  <input className={inputClass} type="number" value={zoneAvgUsdM2} onChange={e => setZoneAvgUsdM2(e.target.value)} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 1: FODA */}
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Análisis FODA</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Fortalezas</label>
                <textarea className={`${inputClass} h-24`} value={strengths} onChange={e => setStrengths(e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>Debilidades</label>
                <textarea className={`${inputClass} h-24`} value={weaknesses} onChange={e => setWeaknesses(e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>Oportunidades</label>
                <textarea className={`${inputClass} h-24`} value={opportunities} onChange={e => setOpportunities(e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>Amenazas</label>
                <textarea className={`${inputClass} h-24`} value={threats} onChange={e => setThreats(e.target.value)} />
              </div>
            </div>
            <div>
              <label className={labelClass}>Análisis de publicación actual</label>
              <textarea className={`${inputClass} h-28`} value={pubAnalysis} onChange={e => setPubAnalysis(e.target.value)} />
            </div>
          </div>
        )}

        {/* STEP 2: Competencia */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-800">Competencia ZonaProp</h2>
              {comparables.length < 6 && (
                <button onClick={addComparable} className="flex items-center gap-1 text-xs text-[#ff007c] font-medium hover:underline">
                  <Plus className="w-3 h-3" /> Agregar
                </button>
              )}
            </div>
            {comparables.map((comp, i) => (
              <div key={i} className="border border-gray-100 rounded-xl p-3 sm:p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-700">Comparable {i + 1}</h3>
                  {comparables.length > 1 && (
                    <button onClick={() => removeComparable(i)} className="text-red-400 hover:text-red-600">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <input
                  className={inputClass}
                  value={comp.zonaprop_url}
                  onChange={e => updateComparable(i, 'zonaprop_url', e.target.value)}
                  placeholder="Link de ZonaProp (referencia)"
                />
                <div
                  onPaste={e => handlePaste(i, e)}
                  tabIndex={0}
                  className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer focus:outline-none focus:border-[#ff007c] ${
                    comp.loading ? 'border-indigo-300 bg-indigo-50' : 'border-gray-200 hover:border-[#ff007c]/50'
                  }`}
                >
                  {comp.loading ? (
                    <div className="flex items-center justify-center gap-2 text-indigo-600">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span className="text-sm">Extrayendo datos...</span>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-center justify-center gap-2 text-gray-400 mb-1">
                        <Clipboard className="w-5 h-5" />
                        <span className="text-sm">Click acá y pegá screenshot (Ctrl+V)</span>
                      </div>
                      <label className="inline-flex items-center gap-1 mt-2 text-xs text-indigo-600 cursor-pointer hover:underline">
                        O subí una imagen
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={e => { const f = e.target.files?.[0]; if (f) extractFromImage(i, f) }}
                        />
                      </label>
                    </div>
                  )}
                </div>
                {pastedImages[i]?.length > 0 && (
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {pastedImages[i].map((src, j) => (
                      <img key={j} src={src} alt="" className="h-16 rounded-lg border flex-shrink-0" />
                    ))}
                  </div>
                )}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div>
                    <label className="text-[10px] text-gray-500">Dirección</label>
                    <input className={`${inputClass} text-xs`} value={comp.address} onChange={e => updateComparable(i, 'address', e.target.value)} />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500">Precio USD</label>
                    <input className={`${inputClass} text-xs`} type="number" value={comp.price} onChange={e => updateComparable(i, 'price', e.target.value)} />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500">m² total</label>
                    <input className={`${inputClass} text-xs`} type="number" value={comp.total_area} onChange={e => updateComparable(i, 'total_area', e.target.value)} />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500">m² cubierto</label>
                    <input className={`${inputClass} text-xs`} type="number" value={comp.covered_area} onChange={e => updateComparable(i, 'covered_area', e.target.value)} />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500">USD/m²</label>
                    <input className={`${inputClass} text-xs`} type="number" value={comp.usd_per_m2} onChange={e => updateComparable(i, 'usd_per_m2', e.target.value)} />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500">Días en venta</label>
                    <input className={`${inputClass} text-xs`} type="number" value={comp.days_on_market} onChange={e => updateComparable(i, 'days_on_market', e.target.value)} />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500">Vistas 30d</label>
                    <input className={`${inputClass} text-xs`} type="number" value={comp.views_per_day} onChange={e => updateComparable(i, 'views_per_day', e.target.value)} />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500">Antigüedad</label>
                    <input className={`${inputClass} text-xs`} type="number" value={comp.age} onChange={e => updateComparable(i, 'age', e.target.value)} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* STEP 3: Tasación */}
        {step === 3 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Tasación proyectada</h2>
            <div className="bg-gray-50 rounded-xl p-4 grid grid-cols-2 gap-4 text-center">
              <div>
                <p className="text-xs text-gray-500">Sup. ponderada</p>
                <p className="text-xl font-bold text-gray-800">{weightedArea.toFixed(1)} m²</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">USD/m² prom.</p>
                <p className="text-xl font-bold text-[#ff007c]">USD {avgUsdM2.toLocaleString('es-AR')}</p>
              </div>
            </div>
            {avgUsdM2 > 0 && weightedArea > 0 && (
              <div className="bg-[#ff007c]/5 border border-[#ff007c]/20 rounded-xl p-4 text-center">
                <p className="text-xs text-gray-500 mb-1">Valor estimado</p>
                <p className="text-2xl font-bold text-[#ff007c]">USD {Math.round(weightedArea * avgUsdM2).toLocaleString('es-AR')}</p>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className={labelClass}>Valor sugerido (USD)</label>
                <input className={inputClass} type="number" value={suggestedPrice} onChange={e => setSuggestedPrice(e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>Prueba 30 días (USD)</label>
                <input className={inputClass} type="number" value={testPrice} onChange={e => setTestPrice(e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>Cierre 120 días (USD)</label>
                <input className={inputClass} type="number" value={expectedClose} onChange={e => setExpectedClose(e.target.value)} />
              </div>
            </div>
            <div>
              <label className={labelClass}>Notas del agente</label>
              <textarea className={`${inputClass} h-24`} value={agentNotes} onChange={e => setAgentNotes(e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>
                Video explicando la tasación{' '}
                <span className="text-gray-400 font-normal">(URL YouTube embed)</span>
              </label>
              <input
                className={inputClass}
                value={videoTasacionUrl}
                onChange={e => setVideoTasacionUrl(e.target.value)}
                placeholder="https://www.youtube.com/embed/..."
              />
            </div>
          </div>
        )}

        {/* STEP 4: Resumen */}
        {step === 4 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Resumen</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-gray-50 rounded-xl p-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">
                  <MapPin className="w-4 h-4 text-[#ff007c] inline mr-1" />
                  Propiedad
                </h3>
                <p className="text-sm font-medium">{address}</p>
                <p className="text-xs text-gray-500">{neighborhood}, {city} · {propertyType}</p>
                <p className="text-xs text-gray-500 mt-1">{coveredArea}m² cub / {totalArea}m² tot / Pond: {weightedArea.toFixed(1)}m²</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">
                  <DollarSign className="w-4 h-4 text-[#ff007c] inline mr-1" />
                  Tasación
                </h3>
                <div className="space-y-1 text-sm">
                  {suggestedPrice && <p>Sugerido: <span className="font-semibold">USD {Number(suggestedPrice).toLocaleString('es-AR')}</span></p>}
                  {testPrice && <p>Prueba: <span className="font-semibold">USD {Number(testPrice).toLocaleString('es-AR')}</span></p>}
                  {expectedClose && <p>Cierre: <span className="font-semibold">USD {Number(expectedClose).toLocaleString('es-AR')}</span></p>}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-100">
          {step > 0 ? (
            <button
              onClick={() => setStep(step - 1)}
              className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"
            >
              <ArrowLeft className="w-4 h-4" /> Anterior
            </button>
          ) : <div />}
          {step < steps.length - 1 ? (
            <button
              onClick={() => setStep(step + 1)}
              className="flex items-center gap-2 bg-[#ff007c] text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:opacity-90"
            >
              Siguiente <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={saving || !address}
              className="flex items-center gap-2 bg-[#ff007c] text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              Guardar cambios
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
