'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Save, Loader2, Trash2, Plus, Clipboard } from 'lucide-react'

interface Comparable {
  id?: string
  zonaprop_url: string; address: string; total_area: string; covered_area: string
  price: string; usd_per_m2: string; days_on_market: string; views_per_day: string; age: string
}

export default function EditarTasacionPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [extractingIdx, setExtractingIdx] = useState<number | null>(null)

  // Fields
  const [address, setAddress] = useState('')
  const [neighborhood, setNeighborhood] = useState('')
  const [city, setCity] = useState('')
  const [propertyType, setPropertyType] = useState('')
  const [coveredArea, setCoveredArea] = useState('')
  const [totalArea, setTotalArea] = useState('')
  const [semiArea, setSemiArea] = useState('')
  const [strengths, setStrengths] = useState('')
  const [weaknesses, setWeaknesses] = useState('')
  const [opportunities, setOpportunities] = useState('')
  const [threats, setThreats] = useState('')
  const [pubAnalysis, setPubAnalysis] = useState('')
  const [suggestedPrice, setSuggestedPrice] = useState('')
  const [testPrice, setTestPrice] = useState('')
  const [expectedClose, setExpectedClose] = useState('')
  const [videoUrl, setVideoUrl] = useState('')
  const [agentNotes, setAgentNotes] = useState('')
  const [zoneAvgPrice, setZoneAvgPrice] = useState('')
  const [zoneAvgM2, setZoneAvgM2] = useState('')
  const [zoneAvgUsdM2, setZoneAvgUsdM2] = useState('')
  const [comparables, setComparables] = useState<Comparable[]>([])

  const weightedArea = (parseFloat(coveredArea) || 0) + (parseFloat(semiArea) || 0) * 0.75 + ((parseFloat(totalArea) || 0) - (parseFloat(coveredArea) || 0) - (parseFloat(semiArea) || 0)) * 0.25
  const avgUsdM2 = (() => {
    const prices = comparables.filter(c => parseFloat(c.usd_per_m2) > 0).map(c => parseFloat(c.usd_per_m2))
    return prices.length > 0 ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : 0
  })()

  useEffect(() => {
    fetch(`/api/tasaciones/${id}`).then(r => r.json()).then((data: any) => {
      setAddress(data.property_address || '')
      setNeighborhood(data.neighborhood || '')
      setCity(data.city || '')
      setPropertyType(data.property_type || '')
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
      setVideoUrl(data.video_url || '')
      setAgentNotes(data.agent_notes || '')
      setZoneAvgPrice(data.zone_avg_price?.toString() || '')
      setZoneAvgM2(data.zone_avg_m2?.toString() || '')
      setZoneAvgUsdM2(data.zone_avg_usd_m2?.toString() || '')
      if (data.comparables?.length) {
        setComparables(data.comparables.map((c: any) => ({
          id: c.id, zonaprop_url: c.zonaprop_url || '', address: c.address || '',
          total_area: c.total_area?.toString() || '', covered_area: c.covered_area?.toString() || '',
          price: c.price?.toString() || '', usd_per_m2: c.usd_per_m2?.toString() || '',
          days_on_market: c.days_on_market?.toString() || '', views_per_day: c.views_per_day?.toString() || '',
          age: c.age?.toString() || '',
        })))
      }
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [id])

  async function extractFromImage(index: number, file: File) {
    setExtractingIdx(index)
    try {
      const formData = new FormData()
      formData.append('screenshot', file)
      const res = await fetch('/api/extract-zonaprop', { method: 'POST', body: formData })
      const data = (await res.json()) as any
      if (data.success && data.data) {
        setComparables(prev => {
          const updated = [...prev]
          const d = data.data
          updated[index] = {
            ...updated[index],
            address: d.address || updated[index].address,
            total_area: d.total_area?.toString() || updated[index].total_area,
            covered_area: d.covered_area?.toString() || updated[index].covered_area,
            price: d.price?.toString() || updated[index].price,
            usd_per_m2: d.usd_per_m2?.toString() || updated[index].usd_per_m2,
            days_on_market: d.days_on_market?.toString() || updated[index].days_on_market,
            views_per_day: d.views_per_day?.toString() || updated[index].views_per_day,
            age: d.age?.toString() || updated[index].age,
          }
          return updated
        })
      } else {
        alert('No se pudieron extraer datos del screenshot')
      }
    } catch { alert('Error al procesar') }
    finally { setExtractingIdx(null) }
  }

  async function handleSave() {
    setSaving(true)
    try {
      await fetch(`/api/tasaciones/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          property_address: address, neighborhood, city, property_type: propertyType,
          covered_area: parseFloat(coveredArea) || null, total_area: parseFloat(totalArea) || null,
          semi_area: parseFloat(semiArea) || null, weighted_area: weightedArea || null,
          strengths: strengths || null, weaknesses: weaknesses || null,
          opportunities: opportunities || null, threats: threats || null,
          publication_analysis: pubAnalysis || null,
          suggested_price: parseFloat(suggestedPrice) || null,
          test_price: parseFloat(testPrice) || null,
          expected_close_price: parseFloat(expectedClose) || null,
          usd_per_m2: avgUsdM2 || null, video_url: videoUrl || null,
          agent_notes: agentNotes || null,
          zone_avg_price: parseFloat(zoneAvgPrice) || null,
          zone_avg_m2: parseFloat(zoneAvgM2) || null,
          zone_avg_usd_m2: parseFloat(zoneAvgUsdM2) || null,
        }),
      })
      router.push(`/tasaciones/${id}`)
      router.refresh()
    } catch { alert('Error al guardar') }
    finally { setSaving(false) }
  }

  if (loading) return <div className="flex items-center gap-2 text-brand-gray"><Loader2 className="w-5 h-5 animate-spin" /> Cargando...</div>

  const inputClass = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-pink/50"

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <Link href={`/tasaciones/${id}`} className="inline-flex items-center gap-2 text-sm text-brand-gray hover:text-gray-800">
          <ArrowLeft className="w-4 h-4" /> Volver
        </Link>
        <button onClick={handleSave} disabled={saving} className="inline-flex items-center gap-2 bg-brand-pink text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </div>

      <h1 className="text-xl font-semibold text-gray-800 mb-6">Editar tasaci&oacute;n</h1>

      <div className="space-y-6">
        {/* Property data */}
        <section className="bg-white rounded-xl shadow-sm p-5">
          <h2 className="font-medium text-gray-800 mb-4">Datos de la propiedad</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className="block text-xs text-gray-500 mb-1">Direcci&oacute;n</label><input value={address} onChange={e => setAddress(e.target.value)} className={inputClass} /></div>
            <div><label className="block text-xs text-gray-500 mb-1">Barrio</label><input value={neighborhood} onChange={e => setNeighborhood(e.target.value)} className={inputClass} /></div>
            <div><label className="block text-xs text-gray-500 mb-1">Ciudad</label><input value={city} onChange={e => setCity(e.target.value)} className={inputClass} /></div>
            <div><label className="block text-xs text-gray-500 mb-1">Tipolog&iacute;a</label>
              <select value={propertyType} onChange={e => setPropertyType(e.target.value)} className={inputClass}>
                <option value="departamento">Departamento</option><option value="casa">Casa</option><option value="ph">PH</option>
                <option value="local">Local</option><option value="terreno">Terreno</option><option value="oficina">Oficina</option>
              </select>
            </div>
            <div><label className="block text-xs text-gray-500 mb-1">Sup. cubierta m&sup2;</label><input type="number" value={coveredArea} onChange={e => setCoveredArea(e.target.value)} className={inputClass} /></div>
            <div><label className="block text-xs text-gray-500 mb-1">Sup. total m&sup2;</label><input type="number" value={totalArea} onChange={e => setTotalArea(e.target.value)} className={inputClass} /></div>
            <div><label className="block text-xs text-gray-500 mb-1">Sup. semi m&sup2;</label><input type="number" value={semiArea} onChange={e => setSemiArea(e.target.value)} className={inputClass} /></div>
            <div className="bg-brand-pink/5 border border-brand-pink/20 rounded-lg p-3 text-center">
              <p className="text-xs text-gray-500">Ponderada</p>
              <p className="font-bold text-brand-pink">{weightedArea.toFixed(1)} m&sup2;</p>
            </div>
          </div>
        </section>

        {/* Zone averages */}
        <section className="bg-white rounded-xl shadow-sm p-5">
          <h2 className="font-medium text-gray-800 mb-4">Valores promedio de la zona</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div><label className="block text-xs text-gray-500 mb-1">Precio promedio USD</label><input type="number" value={zoneAvgPrice} onChange={e => setZoneAvgPrice(e.target.value)} className={inputClass} /></div>
            <div><label className="block text-xs text-gray-500 mb-1">m&sup2; promedio</label><input type="number" value={zoneAvgM2} onChange={e => setZoneAvgM2(e.target.value)} className={inputClass} /></div>
            <div><label className="block text-xs text-gray-500 mb-1">USD/m&sup2; promedio</label><input type="number" value={zoneAvgUsdM2} onChange={e => setZoneAvgUsdM2(e.target.value)} className={inputClass} /></div>
          </div>
        </section>

        {/* FODA */}
        <section className="bg-white rounded-xl shadow-sm p-5">
          <h2 className="font-medium text-gray-800 mb-4">An&aacute;lisis FODA</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className="block text-xs text-gray-500 mb-1">Fortalezas</label><textarea value={strengths} onChange={e => setStrengths(e.target.value)} rows={3} className={inputClass} /></div>
            <div><label className="block text-xs text-gray-500 mb-1">Debilidades</label><textarea value={weaknesses} onChange={e => setWeaknesses(e.target.value)} rows={3} className={inputClass} /></div>
            <div><label className="block text-xs text-gray-500 mb-1">Oportunidades</label><textarea value={opportunities} onChange={e => setOpportunities(e.target.value)} rows={3} className={inputClass} /></div>
            <div><label className="block text-xs text-gray-500 mb-1">Amenazas</label><textarea value={threats} onChange={e => setThreats(e.target.value)} rows={3} className={inputClass} /></div>
          </div>
          <div className="mt-3"><label className="block text-xs text-gray-500 mb-1">An&aacute;lisis publicaci&oacute;n actual</label><textarea value={pubAnalysis} onChange={e => setPubAnalysis(e.target.value)} rows={3} className={inputClass} /></div>
        </section>

        {/* Comparables */}
        <section className="bg-white rounded-xl shadow-sm p-5">
          <h2 className="font-medium text-gray-800 mb-4">Competencia</h2>
          {comparables.map((c, idx) => (
            <div key={idx} className="border border-gray-200 rounded-lg p-4 mb-3 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Comparable {idx + 1}</span>
                <div className="flex items-center gap-2">
                  <label className="inline-flex items-center gap-1 text-xs text-indigo-600 cursor-pointer bg-indigo-50 px-2 py-1 rounded">
                    <Clipboard className="w-3 h-3" />
                    {extractingIdx === idx ? 'Extrayendo...' : 'Screenshot'}
                    <input type="file" accept="image/*" className="hidden" disabled={extractingIdx !== null}
                      onChange={e => { const f = e.target.files?.[0]; if (f) extractFromImage(idx, f) }} />
                  </label>
                  <button onClick={() => setComparables(prev => prev.filter((_, i) => i !== idx))} className="text-red-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
              {extractingIdx === idx && <div className="flex items-center gap-2 text-xs text-indigo-600 bg-indigo-50 p-2 rounded"><Loader2 className="w-3 h-3 animate-spin" /> Extrayendo con IA...</div>}
              <div
                className="border-2 border-dashed border-gray-200 rounded-lg p-2 text-center text-xs text-gray-400 cursor-pointer hover:border-indigo-300"
                tabIndex={0}
                onPaste={e => {
                  const items = e.clipboardData?.items
                  if (!items) return
                  for (const item of Array.from(items)) {
                    if (item.type.startsWith('image/')) {
                      const file = item.getAsFile()
                      if (file) extractFromImage(idx, file)
                      break
                    }
                  }
                }}
              >Peg&aacute; screenshot aqu&iacute; (Ctrl+V)</div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div><label className="block text-[10px] text-gray-400">Direcci&oacute;n</label><input value={c.address} onChange={e => { const u = [...comparables]; u[idx] = { ...u[idx], address: e.target.value }; setComparables(u) }} className={inputClass} /></div>
                <div><label className="block text-[10px] text-gray-400">Precio USD</label><input type="number" value={c.price} onChange={e => { const u = [...comparables]; u[idx] = { ...u[idx], price: e.target.value }; setComparables(u) }} className={inputClass} /></div>
                <div><label className="block text-[10px] text-gray-400">m&sup2; total</label><input type="number" value={c.total_area} onChange={e => { const u = [...comparables]; u[idx] = { ...u[idx], total_area: e.target.value }; setComparables(u) }} className={inputClass} /></div>
                <div><label className="block text-[10px] text-gray-400">USD/m&sup2;</label><input type="number" value={c.usd_per_m2} onChange={e => { const u = [...comparables]; u[idx] = { ...u[idx], usd_per_m2: e.target.value }; setComparables(u) }} className={inputClass} /></div>
                <div><label className="block text-[10px] text-gray-400">D&iacute;as</label><input type="number" value={c.days_on_market} onChange={e => { const u = [...comparables]; u[idx] = { ...u[idx], days_on_market: e.target.value }; setComparables(u) }} className={inputClass} /></div>
                <div><label className="block text-[10px] text-gray-400">Vistas/d&iacute;a</label><input type="number" value={c.views_per_day} onChange={e => { const u = [...comparables]; u[idx] = { ...u[idx], views_per_day: e.target.value }; setComparables(u) }} className={inputClass} /></div>
                <div><label className="block text-[10px] text-gray-400">Antig&uuml;edad</label><input type="number" value={c.age} onChange={e => { const u = [...comparables]; u[idx] = { ...u[idx], age: e.target.value }; setComparables(u) }} className={inputClass} /></div>
                <div><label className="block text-[10px] text-gray-400">URL aviso</label><input value={c.zonaprop_url} onChange={e => { const u = [...comparables]; u[idx] = { ...u[idx], zonaprop_url: e.target.value }; setComparables(u) }} className={inputClass} /></div>
              </div>
            </div>
          ))}
          <button onClick={() => setComparables(prev => [...prev, { zonaprop_url: '', address: '', total_area: '', covered_area: '', price: '', usd_per_m2: '', days_on_market: '', views_per_day: '', age: '' }])} className="inline-flex items-center gap-1 text-sm text-brand-pink font-medium hover:underline mt-2">
            <Plus className="w-4 h-4" /> Agregar comparable
          </button>
        </section>

        {/* Valuation */}
        <section className="bg-white rounded-xl shadow-sm p-5">
          <h2 className="font-medium text-gray-800 mb-4">Tasaci&oacute;n</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
            <div className="bg-indigo-50 rounded-lg p-3 text-center">
              <p className="text-xs text-gray-500">Ponderada</p><p className="font-bold text-indigo-600">{weightedArea.toFixed(1)} m&sup2;</p>
            </div>
            <div className="bg-brand-pink/5 rounded-lg p-3 text-center">
              <p className="text-xs text-gray-500">USD/m&sup2; promedio</p><p className="font-bold text-brand-pink">{avgUsdM2.toLocaleString('es-AR')}</p>
            </div>
            <div className="bg-green-50 rounded-lg p-3 text-center">
              <p className="text-xs text-gray-500">Valor estimado</p><p className="font-bold text-green-600">USD {Math.round(weightedArea * avgUsdM2).toLocaleString('es-AR')}</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div><label className="block text-xs text-gray-500 mb-1">Valor sugerido USD</label><input type="number" value={suggestedPrice} onChange={e => setSuggestedPrice(e.target.value)} className={inputClass} /></div>
            <div><label className="block text-xs text-gray-500 mb-1">Valor prueba 30d USD</label><input type="number" value={testPrice} onChange={e => setTestPrice(e.target.value)} className={inputClass} /></div>
            <div><label className="block text-xs text-gray-500 mb-1">Cierre esperado 120d USD</label><input type="number" value={expectedClose} onChange={e => setExpectedClose(e.target.value)} className={inputClass} /></div>
          </div>
        </section>

        {/* Video + Notes */}
        <section className="bg-white rounded-xl shadow-sm p-5">
          <h2 className="font-medium text-gray-800 mb-4">Video y notas</h2>
          <div className="space-y-3">
            <div><label className="block text-xs text-gray-500 mb-1">URL video tasaci&oacute;n (YouTube)</label><input value={videoUrl} onChange={e => setVideoUrl(e.target.value)} placeholder="https://www.youtube.com/watch?v=..." className={inputClass} /></div>
            <div><label className="block text-xs text-gray-500 mb-1">Explicaci&oacute;n de la tasaci&oacute;n</label><textarea value={agentNotes} onChange={e => setAgentNotes(e.target.value)} rows={4} placeholder="Breve explicaci&oacute;n para el propietario..." className={inputClass} /></div>
          </div>
        </section>

        {/* Save */}
        <div className="flex gap-3">
          <button onClick={handleSave} disabled={saving} className="flex-1 bg-brand-pink text-white py-3 rounded-lg font-medium hover:opacity-90 disabled:opacity-50">
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
          <Link href={`/tasaciones/${id}`} className="flex-1 border border-gray-300 text-gray-700 py-3 rounded-lg font-medium text-center hover:bg-gray-50">
            Cancelar
          </Link>
        </div>
      </div>
    </div>
  )
}
