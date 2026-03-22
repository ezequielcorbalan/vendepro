'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, ArrowRight, Home, Shield, Search, DollarSign, Eye,
  Plus, Trash2, Loader2, MapPin, CheckCircle, Clipboard, Image
} from 'lucide-react'
import Link from 'next/link'

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
  { label: 'Tasaci\u00f3n', icon: DollarSign },
  { label: 'Generar', icon: Eye },
]

export default function NuevaTasacionPage() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)

  // Step 1: Property data
  const [address, setAddress] = useState('')
  const [neighborhood, setNeighborhood] = useState('')
  const [city, setCity] = useState('Buenos Aires')
  const [propertyType, setPropertyType] = useState('departamento')
  const [coveredArea, setCoveredArea] = useState('')
  const [totalArea, setTotalArea] = useState('')
  const [semiArea, setSemiArea] = useState('')
  const [age, setAge] = useState('')

  // Step 2: FODA
  const [strengths, setStrengths] = useState('')
  const [weaknesses, setWeaknesses] = useState('')
  const [opportunities, setOpportunities] = useState('')
  const [threats, setThreats] = useState('')
  const [pubAnalysis, setPubAnalysis] = useState('')

  // Step 3: Comparables
  const [comparables, setComparables] = useState<Comparable[]>([emptyComparable(), emptyComparable()])
  const [pastedImages, setPastedImages] = useState<Record<number, string[]>>({})

  // Step 4: Valuation
  const [suggestedPrice, setSuggestedPrice] = useState('')
  const [testPrice, setTestPrice] = useState('')
  const [expectedClose, setExpectedClose] = useState('')
  const [agentNotes, setAgentNotes] = useState('')

  // Calculations
  const weightedArea = (parseFloat(coveredArea) || 0) + (parseFloat(semiArea) || 0) * 0.75 + ((parseFloat(totalArea) || 0) - (parseFloat(coveredArea) || 0) - (parseFloat(semiArea) || 0)) * 0.25
  const avgUsdM2 = (() => {
    const prices = comparables.filter(c => parseFloat(c.usd_per_m2) > 0).map(c => parseFloat(c.usd_per_m2))
    return prices.length > 0 ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : 0
  })()

  async function extractFromImage(index: number, file: File) {
    const updated = [...comparables]
    updated[index] = { ...updated[index], loading: true }
    setComparables(updated)

    // Show preview of pasted image
    const reader = new FileReader()
    reader.onload = (e) => {
      setPastedImages(prev => ({
        ...prev,
        [index]: [...(prev[index] || []), e.target?.result as string]
      }))
    }
    reader.readAsDataURL(file)

    try {
      const formData = new FormData()
      formData.append('screenshot', file)

      const res = await fetch('/api/extract-zonaprop', {
        method: 'POST',
        body: formData,
      })
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
        alert('No se pudieron extraer datos. Cargalos manualmente.')
      }
    } catch {
      const final = [...comparables]
      final[index] = { ...final[index], loading: false }
      setComparables(final)
      alert('Error al conectar con el servidor.')
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

  function addComparable() {
    if (comparables.length < 6) setComparables([...comparables, emptyComparable()])
  }

  function removeComparable(i: number) {
    if (comparables.length > 1) setComparables(comparables.filter((_, idx) => idx !== i))
  }

  function updateComparable(i: number, field: keyof Comparable, value: string) {
    const updated = [...comparables]
    updated[i] = { ...updated[i], [field]: value }
    // Auto-calculate USD/m2
    if ((field === 'price' || field === 'total_area') && updated[i].price && updated[i].total_area) {
      const p = parseFloat(updated[i].price)
      const a = parseFloat(updated[i].total_area)
      if (p > 0 && a > 0) updated[i].usd_per_m2 = Math.round(p / a).toString()
    }
    setComparables(updated)
  }

  async function handleSubmit() {
    setSaving(true)
    try {
      const res = await fetch('/api/tasaciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address, neighborhood, city, property_type: propertyType,
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
      if (data.id) {
        router.push('/tasaciones')
      } else {
        alert(data.error || 'Error al guardar')
      }
    } catch {
      alert('Error al conectar')
    }
    setSaving(false)
  }

  const inputClass = "w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand-pink/20 focus:border-brand-pink outline-none"
  const labelClass = "block text-sm font-medium text-gray-700 mb-1"

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/tasaciones" className="p-2 rounded-lg hover:bg-gray-100">
          <ArrowLeft className="w-5 h-5 text-gray-500" />
        </Link>
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-800">Nueva tasaci&oacute;n</h1>
          <p className="text-brand-gray text-sm">Paso {step + 1} de {steps.length}</p>
        </div>
      </div>

      {/* Step indicators */}
      <div className="flex gap-1 sm:gap-2 mb-6 overflow-x-auto pb-2">
        {steps.map((s, i) => {
          const Icon = s.icon
          return (
            <button
              key={i}
              onClick={() => i < step && setStep(i)}
              className={`flex items-center gap-1.5 px-2.5 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap transition-colors ${
                i === step ? 'bg-brand-pink text-white' :
                i < step ? 'bg-brand-pink/10 text-brand-pink cursor-pointer' :
                'bg-gray-100 text-gray-400'
              }`}
            >
              {i < step ? <CheckCircle className="w-3.5 h-3.5" /> : <Icon className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{s.label}</span>
            </button>
          )
        })}
      </div>

      {/* Step content */}
      <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6">
        {/* STEP 1: Property */}
        {step === 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Datos de la propiedad</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className={labelClass}>Direcci&oacute;n *</label>
                <input className={inputClass} value={address} onChange={e => setAddress(e.target.value)} placeholder="Ej: Pelliza 490" />
              </div>
              <div>
                <label className={labelClass}>Barrio *</label>
                <input className={inputClass} value={neighborhood} onChange={e => setNeighborhood(e.target.value)} placeholder="Ej: Olivos" />
              </div>
              <div>
                <label className={labelClass}>Ciudad</label>
                <input className={inputClass} value={city} onChange={e => setCity(e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>Tipolog&iacute;a</label>
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
                <label className={labelClass}>Antig&uuml;edad (a&ntilde;os)</label>
                <input className={inputClass} type="number" value={age} onChange={e => setAge(e.target.value)} placeholder="0" />
              </div>
            </div>

            <div className="border-t border-gray-100 pt-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Superficies (m&sup2;)</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className={labelClass}>Cubierta</label>
                  <input className={inputClass} type="number" value={coveredArea} onChange={e => setCoveredArea(e.target.value)} placeholder="0" />
                </div>
                <div>
                  <label className={labelClass}>Total</label>
                  <input className={inputClass} type="number" value={totalArea} onChange={e => setTotalArea(e.target.value)} placeholder="0" />
                </div>
                <div>
                  <label className={labelClass}>Semicubierta</label>
                  <input className={inputClass} type="number" value={semiArea} onChange={e => setSemiArea(e.target.value)} placeholder="0" />
                </div>
                <div>
                  <label className={labelClass}>Ponderada</label>
                  <div className="bg-brand-pink/5 border border-brand-pink/20 rounded-lg px-3 py-2.5 text-sm font-semibold text-brand-pink">
                    {weightedArea.toFixed(1)} m&sup2;
                  </div>
                </div>
              </div>
              <p className="text-[10px] sm:text-xs text-gray-400 mt-2">Cubierta 100% + Semi 75% + Descubierta 25%</p>
            </div>
          </div>
        )}

        {/* STEP 2: FODA */}
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">An&aacute;lisis FODA</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Fortalezas</label>
                <textarea className={`${inputClass} h-24 sm:h-28`} value={strengths} onChange={e => setStrengths(e.target.value)} placeholder="Cochera, balc&oacute;n terraza, vista..." />
              </div>
              <div>
                <label className={labelClass}>Debilidades</label>
                <textarea className={`${inputClass} h-24 sm:h-28`} value={weaknesses} onChange={e => setWeaknesses(e.target.value)} placeholder="Tama&ntilde;o dormitorios, cochera..." />
              </div>
              <div>
                <label className={labelClass}>Oportunidades</label>
                <textarea className={`${inputClass} h-24 sm:h-28`} value={opportunities} onChange={e => setOpportunities(e.target.value)} placeholder="Cr&eacute;dito hipotecario..." />
              </div>
              <div>
                <label className={labelClass}>Amenazas</label>
                <textarea className={`${inputClass} h-24 sm:h-28`} value={threats} onChange={e => setThreats(e.target.value)} placeholder="Posibilidad de construcci&oacute;n al lado..." />
              </div>
            </div>
            <div>
              <label className={labelClass}>An&aacute;lisis de publicaci&oacute;n actual</label>
              <textarea className={`${inputClass} h-28 sm:h-32`} value={pubAnalysis} onChange={e => setPubAnalysis(e.target.value)} placeholder="Solo fotos de celular, se puede mejorar con plano, video, tour 360..." />
            </div>
          </div>
        )}

        {/* STEP 3: Comparables */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-800">Competencia ZonaProp</h2>
              {comparables.length < 6 && (
                <button onClick={addComparable} className="flex items-center gap-1 text-xs text-brand-pink font-medium hover:underline">
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

                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    className={`${inputClass} flex-1`}
                    value={comp.zonaprop_url}
                    onChange={e => updateComparable(i, 'zonaprop_url', e.target.value)}
                    placeholder="Peg&aacute; el link de ZonaProp (referencia)"
                  />
                </div>

                {/* Paste zone */}
                <div
                  onPaste={e => handlePaste(i, e)}
                  tabIndex={0}
                  className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors focus:outline-none focus:border-brand-pink ${
                    comp.loading ? 'border-indigo-300 bg-indigo-50' : 'border-gray-200 hover:border-brand-pink/50 hover:bg-brand-pink/5'
                  }`}
                >
                  {comp.loading ? (
                    <div className="flex items-center justify-center gap-2 text-indigo-600">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span className="text-sm font-medium">Extrayendo datos...</span>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-center justify-center gap-2 text-gray-400 mb-1">
                        <Clipboard className="w-5 h-5" />
                        <span className="text-sm font-medium">Click ac&aacute; y peg&aacute; screenshot (Ctrl+V)</span>
                      </div>
                      <p className="text-[10px] text-gray-400">
                        Us&aacute; la herramienta recortar en ZonaProp y pegalo directo. Pod&eacute;s pegar varias veces para completar datos.
                      </p>
                      <label className="inline-flex items-center gap-1 mt-2 text-xs text-indigo-600 cursor-pointer hover:underline">
                        <Image className="w-3 h-3" /> O sub&iacute; una imagen
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          disabled={comp.loading}
                          onChange={e => {
                            const file = e.target.files?.[0]
                            if (file) extractFromImage(i, file)
                          }}
                        />
                      </label>
                    </div>
                  )}
                </div>

                {/* Pasted image previews */}
                {pastedImages[i]?.length > 0 && (
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {pastedImages[i].map((src, j) => (
                      <img key={j} src={src} alt={`Screenshot ${j + 1}`} className="h-16 rounded-lg border border-gray-200 flex-shrink-0" />
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div>
                    <label className="text-[10px] sm:text-xs text-gray-500">Direcci&oacute;n</label>
                    <input className={`${inputClass} text-xs`} value={comp.address} onChange={e => updateComparable(i, 'address', e.target.value)} />
                  </div>
                  <div>
                    <label className="text-[10px] sm:text-xs text-gray-500">Precio USD</label>
                    <input className={`${inputClass} text-xs`} type="number" value={comp.price} onChange={e => updateComparable(i, 'price', e.target.value)} />
                  </div>
                  <div>
                    <label className="text-[10px] sm:text-xs text-gray-500">m&sup2; total</label>
                    <input className={`${inputClass} text-xs`} type="number" value={comp.total_area} onChange={e => updateComparable(i, 'total_area', e.target.value)} />
                  </div>
                  <div>
                    <label className="text-[10px] sm:text-xs text-gray-500">USD/m&sup2;</label>
                    <input className={`${inputClass} text-xs`} type="number" value={comp.usd_per_m2} onChange={e => updateComparable(i, 'usd_per_m2', e.target.value)} />
                  </div>
                  <div>
                    <label className="text-[10px] sm:text-xs text-gray-500">D&iacute;as en venta</label>
                    <input className={`${inputClass} text-xs`} type="number" value={comp.days_on_market} onChange={e => updateComparable(i, 'days_on_market', e.target.value)} />
                  </div>
                  <div>
                    <label className="text-[10px] sm:text-xs text-gray-500">Vistas/d&iacute;a</label>
                    <input className={`${inputClass} text-xs`} type="number" value={comp.views_per_day} onChange={e => updateComparable(i, 'views_per_day', e.target.value)} />
                  </div>
                  <div>
                    <label className="text-[10px] sm:text-xs text-gray-500">Antig&uuml;edad</label>
                    <input className={`${inputClass} text-xs`} type="number" value={comp.age} onChange={e => updateComparable(i, 'age', e.target.value)} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* STEP 4: Valuation */}
        {step === 3 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Tasaci&oacute;n proyectada</h2>

            <div className="bg-gray-50 rounded-xl p-4 grid grid-cols-2 gap-4 text-center">
              <div>
                <p className="text-xs text-gray-500">Sup. ponderada</p>
                <p className="text-xl font-bold text-gray-800">{weightedArea.toFixed(1)} m&sup2;</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">USD/m&sup2; prom. comparables</p>
                <p className="text-xl font-bold text-brand-pink">USD {avgUsdM2.toLocaleString('es-AR')}</p>
              </div>
            </div>

            {avgUsdM2 > 0 && weightedArea > 0 && (
              <div className="bg-brand-pink/5 border border-brand-pink/20 rounded-xl p-4 text-center">
                <p className="text-xs text-gray-500 mb-1">Valor estimado (ponderada &times; USD/m&sup2;)</p>
                <p className="text-2xl font-bold text-brand-pink">
                  USD {Math.round(weightedArea * avgUsdM2).toLocaleString('es-AR')}
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className={labelClass}>Valor sugerido (USD)</label>
                <input className={inputClass} type="number" value={suggestedPrice} onChange={e => setSuggestedPrice(e.target.value)} placeholder="575000" />
              </div>
              <div>
                <label className={labelClass}>Valor prueba 30 d&iacute;as (USD)</label>
                <input className={inputClass} type="number" value={testPrice} onChange={e => setTestPrice(e.target.value)} placeholder="599000" />
              </div>
              <div>
                <label className={labelClass}>Precio cierre 120 d&iacute;as (USD)</label>
                <input className={inputClass} type="number" value={expectedClose} onChange={e => setExpectedClose(e.target.value)} placeholder="565000" />
              </div>
            </div>

            <div>
              <label className={labelClass}>Notas del agente</label>
              <textarea className={`${inputClass} h-24`} value={agentNotes} onChange={e => setAgentNotes(e.target.value)} placeholder="Observaciones adicionales..." />
            </div>
          </div>
        )}

        {/* STEP 5: Preview & Generate */}
        {step === 4 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Resumen de la tasaci&oacute;n</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-gray-50 rounded-xl p-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-brand-pink" /> Propiedad
                </h3>
                <p className="text-sm text-gray-800 font-medium">{address}</p>
                <p className="text-xs text-gray-500">{neighborhood}, {city} &middot; {propertyType}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {coveredArea}m&sup2; cub. / {totalArea}m&sup2; total / Pond: {weightedArea.toFixed(1)}m&sup2;
                </p>
              </div>

              <div className="bg-gray-50 rounded-xl p-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-brand-pink" /> Tasaci&oacute;n
                </h3>
                <div className="space-y-1 text-sm">
                  {suggestedPrice && <p>Sugerido: <span className="font-semibold">USD {Number(suggestedPrice).toLocaleString('es-AR')}</span></p>}
                  {testPrice && <p>Prueba 30d: <span className="font-semibold">USD {Number(testPrice).toLocaleString('es-AR')}</span></p>}
                  {expectedClose && <p>Cierre 120d: <span className="font-semibold">USD {Number(expectedClose).toLocaleString('es-AR')}</span></p>}
                  {avgUsdM2 > 0 && <p className="text-xs text-gray-500">USD/m&sup2; prom: {avgUsdM2.toLocaleString('es-AR')}</p>}
                </div>
              </div>
            </div>

            {(strengths || weaknesses) && (
              <div className="bg-gray-50 rounded-xl p-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">FODA</h3>
                <div className="grid grid-cols-2 gap-3 text-xs text-gray-600">
                  {strengths && <div><span className="font-medium text-green-600">Fortalezas:</span> {strengths}</div>}
                  {weaknesses && <div><span className="font-medium text-red-500">Debilidades:</span> {weaknesses}</div>}
                  {opportunities && <div><span className="font-medium text-blue-600">Oportunidades:</span> {opportunities}</div>}
                  {threats && <div><span className="font-medium text-yellow-600">Amenazas:</span> {threats}</div>}
                </div>
              </div>
            )}

            <div className="bg-gray-50 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Comparables ({comparables.filter(c => c.address || c.zonaprop_url).length})</h3>
              <div className="space-y-2">
                {comparables.filter(c => c.address || c.zonaprop_url).map((c, i) => (
                  <div key={i} className="text-xs text-gray-600 flex flex-wrap gap-x-3">
                    <span className="font-medium">{c.address || 'Sin direcci\u00f3n'}</span>
                    {c.price && <span>USD {Number(c.price).toLocaleString('es-AR')}</span>}
                    {c.total_area && <span>{c.total_area}m&sup2;</span>}
                    {c.usd_per_m2 && <span>{c.usd_per_m2} USD/m&sup2;</span>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Navigation buttons */}
      <div className="flex justify-between mt-6">
        <button
          onClick={() => setStep(Math.max(0, step - 1))}
          disabled={step === 0}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-30"
        >
          <ArrowLeft className="w-4 h-4" /> Anterior
        </button>

        {step < steps.length - 1 ? (
          <button
            onClick={() => setStep(step + 1)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium bg-brand-pink text-white hover:opacity-90"
          >
            Siguiente <ArrowRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={saving || !address || !neighborhood}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium bg-green-500 text-white hover:bg-green-600 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
            Guardar tasaci&oacute;n
          </button>
        )}
      </div>
    </div>
  )
}
