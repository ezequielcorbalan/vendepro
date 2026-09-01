'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, ArrowRight, Upload, Check, Loader2, FileText, Link2, Trash2, Clipboard } from 'lucide-react'
import type { MetricSource, ExtractedMetrics } from '@/lib/types'
import { apiFetch } from '@/lib/api'
import { Alert } from '@/components/ui/Alert'
import { Field, Input, Textarea, Select } from '@/components/ui/Input'
import { Heading, Text } from '@/components/ui/Typography'
import { Button } from '@/components/ui/Button'
import { StepIndicator } from '@/components/ui/StepIndicator'

const steps = [
  { id: 1, title: 'Período' },
  { id: 2, title: 'Métricas' },
  { id: 3, title: 'Contenido' },
  { id: 4, title: 'Competencia' },
  { id: 5, title: 'Fotos' },
  { id: 6, title: 'Publicar' },
]

const defaultMetrics = {
  source: 'zonaprop' as MetricSource,
  impressions: '',
  portal_visits: '',
  inquiries: '',
  phone_calls: '',
  whatsapp: '',
  in_person_visits: '',
  offers: '',
  ranking_position: '',
  avg_market_price: '',
}

export default function NuevoReporte() {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const propertyId = params.id as string
  const editId = searchParams.get('edit') || null

  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [extracting, setExtracting] = useState(false)
  const [error, setError] = useState('')
  const [loadingExisting, setLoadingExisting] = useState(!!editId)

  // Step 1: Period
  const [periodLabel, setPeriodLabel] = useState('')
  const [periodStart, setPeriodStart] = useState('')
  const [periodEnd, setPeriodEnd] = useState('')

  // Step 2: Metrics (can add multiple portals)
  const [metricsList, setMetricsList] = useState([{ ...defaultMetrics }])

  // Step 3: Content sections
  const [strategy, setStrategy] = useState('')
  const [marketing, setMarketing] = useState('')
  const [conclusion, setConclusion] = useState('')
  const [priceReference, setPriceReference] = useState('')

  // Step 4: Competitor links
  const [competitors, setCompetitors] = useState<{ url: string; address: string; price: string; notes: string }[]>([])

  // Step 5: Photos
  const [photos, setPhotos] = useState<File[]>([])

  // Competitor extraction
  const [extractingComp, setExtractingComp] = useState<number | null>(null)

  // KiteProp PDF extraction
  const [extractingPdf, setExtractingPdf] = useState(false)

  // Load existing report if editing
  useEffect(() => {
    if (!editId) return
    apiFetch('properties', `/reports/${editId}`)
      .then(r => r.json() as Promise<any>)
      .then(data => {
        if (data.error) { setError(data.error); setLoadingExisting(false); return }
        const rep = data.report || {}
        setPeriodLabel(rep.period_label || '')
        setPeriodStart(rep.period_start || '')
        setPeriodEnd(rep.period_end || '')

        if (Array.isArray(data.metrics) && data.metrics.length > 0) {
          setMetricsList(data.metrics.map((m: any) => ({
            source: m.source || 'zonaprop',
            impressions: m.impressions?.toString() || '',
            portal_visits: m.portal_visits?.toString() || '',
            inquiries: m.inquiries?.toString() || '',
            phone_calls: m.phone_calls?.toString() || '',
            whatsapp: m.whatsapp?.toString() || '',
            in_person_visits: m.in_person_visits?.toString() || '',
            offers: m.offers?.toString() || '',
            ranking_position: m.ranking_position?.toString() || '',
            avg_market_price: m.avg_market_price?.toString() || '',
          })))
        }

        if (Array.isArray(data.content)) {
          for (const c of data.content) {
            if (c.section === 'strategy') setStrategy(c.body || '')
            else if (c.section === 'marketing') setMarketing(c.body || '')
            else if (c.section === 'conclusion') setConclusion(c.body || '')
            else if (c.section === 'price_reference') setPriceReference(c.body || '')
          }
        }

        if (Array.isArray(data.competitors)) {
          setCompetitors(data.competitors.map((c: any) => ({
            url: c.url || '', address: c.address || '',
            price: c.price?.toString() || '', notes: c.notes || '',
          })))
        }

        setLoadingExisting(false)
      })
      .catch(() => { setError('No se pudo cargar el reporte'); setLoadingExisting(false) })
  }, [editId])

  async function handleKitePropPdf(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setExtractingPdf(true)
    setError('')
    try {
      const formData = new FormData()
      formData.append('pdf', file)
      const response = await apiFetch('ai', '/extract-kiteprop', { method: 'POST', body: formData })
      if (!response.ok) throw new Error('Error al extraer datos del PDF')
      const data = await response.json() as any

      // Auto-fill metrics from KiteProp data
      if (data.portals && data.portals.length > 0) {
        const newMetrics = data.portals.map((p: any) => ({
          ...defaultMetrics,
          source: p.source || 'manual',
          inquiries: p.inquiries?.toString() || '',
          portal_visits: p.portal_visits?.toString() || '',
        }))
        setMetricsList(newMetrics)
      }
      if (data.total_visits_presenciales) {
        setMetricsList((prev) => {
          const updated = [...prev]
          if (updated[0]) updated[0].in_person_visits = data.total_visits_presenciales.toString()
          return updated
        })
      }
      if (data.market_comparison?.avg_market_price) {
        setMetricsList((prev) => {
          const updated = [...prev]
          if (updated[0]) updated[0].avg_market_price = data.market_comparison.avg_market_price.toString()
          return updated
        })
      }
    } catch (err) {
      setError('No se pudieron extraer los datos del PDF de KiteProp. Cargalos manualmente.')
    } finally {
      setExtractingPdf(false)
    }
  }

  function addCompetitor() {
    setCompetitors((prev) => [...prev, { url: '', address: '', price: '', notes: '' }])
  }

  function updateCompetitor(index: number, field: string, value: string) {
    setCompetitors((prev) => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      return updated
    })
  }

  function removeCompetitor(index: number) {
    setCompetitors((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleCompetitorScreenshot(file: File, index: number) {
    setExtractingComp(index)
    setError('')
    try {
      const formData = new FormData()
      formData.append('screenshot', file)
      const res = await apiFetch('ai', '/extract-zonaprop', { method: 'POST', body: formData })
      const data = await res.json() as any
      if (data.success && data.data) {
        setCompetitors((prev) => {
          const updated = [...prev]
          updated[index] = {
            ...updated[index],
            address: data.data.address || updated[index].address,
            price: data.data.price?.toString() || updated[index].price,
            notes: [
              data.data.total_area ? `${data.data.total_area}m²` : '',
              data.data.usd_per_m2 ? `${data.data.usd_per_m2} USD/m²` : '',
              data.data.days_on_market ? `${data.data.days_on_market}d` : '',
              data.data.views_per_day ? `${data.data.views_per_day} vistas/d` : '',
            ].filter(Boolean).join(' · ') || updated[index].notes,
          }
          return updated
        })
      } else {
        setError('No se pudieron extraer datos del screenshot')
      }
    } catch {
      setError('Error al procesar el screenshot')
    } finally {
      setExtractingComp(null)
    }
  }

  function updateMetric(index: number, field: string, value: string) {
    setMetricsList((prev) => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      return updated
    })
  }

  function addPortal() {
    setMetricsList((prev) => [...prev, { ...defaultMetrics, source: 'argenprop' as MetricSource }])
  }

  async function handleScreenshot(e: React.ChangeEvent<HTMLInputElement>, index: number) {
    const file = e.target.files?.[0]
    if (!file) return

    setExtracting(true)
    setError('')

    try {
      const formData = new FormData()
      formData.append('screenshot', file)
      formData.append('source', metricsList[index].source)

      const response = await apiFetch('ai', '/extract-metrics', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        throw new Error('Error al extraer datos')
      }

      const extracted: ExtractedMetrics = await response.json()

      setMetricsList((prev) => {
        const updated = [...prev]
        updated[index] = {
          ...updated[index],
          impressions: extracted.impressions?.toString() || '',
          portal_visits: extracted.portal_visits?.toString() || '',
          inquiries: extracted.inquiries?.toString() || '',
          phone_calls: extracted.phone_calls?.toString() || '',
          whatsapp: extracted.whatsapp?.toString() || '',
          ranking_position: extracted.ranking_position?.toString() || '',
        }
        return updated
      })
    } catch (err) {
      setError('No se pudieron extraer los datos del screenshot. Cargalos manualmente.')
    } finally {
      setExtracting(false)
    }
  }

  async function handleSubmit(publish: boolean) {
    setLoading(true)
    setError('')

    try {
      const res = await apiFetch('properties', editId ? `/reports/${editId}` : '/reports', {
        method: editId ? 'PUT' : 'POST',
        body: JSON.stringify({
          propertyId,
          periodLabel,
          periodStart,
          periodEnd,
          metrics: metricsList,
          strategy,
          marketing,
          conclusion,
          priceReference,
          competitors,
          publish,
        }),
      })

      if (!res.ok) {
        const data = await res.json() as any
        setError(data.error || 'Error al crear el reporte')
        setLoading(false)
        return
      }

      const result = await res.json() as any
      const reportId = result.reportId || result.id || editId

      // Upload photos to R2
      if (photos.length > 0 && reportId) {
        for (let i = 0; i < photos.length; i++) {
          const photoForm = new FormData()
          photoForm.append('file', photos[i])
          photoForm.append('reportId', reportId)
          photoForm.append('photoType', 'visit_form')
          photoForm.append('sortOrder', i.toString())
          try {
            const photoRes = await apiFetch('properties', '/upload-photo', { method: 'POST', body: photoForm })
            if (!photoRes.ok) {
              const photoErr = (await photoRes.json()) as any
              throw new Error(photoErr.error || 'Error al subir foto')
            }
          } catch (e: any) {
            setError(`Error al subir foto ${i + 1}: ${e.message}`)
            setLoading(false)
            return
          }
        }
      }

      router.push(`/propiedades/${propertyId}`)
      router.refresh()
    } catch (err: any) {
      setError(err.message || 'Error inesperado')
      setLoading(false)
    }
  }

  return (
    <div>
      <Link
        href={`/propiedades/${propertyId}`}
        className="inline-flex items-center gap-2 text-sm text-brand-gray hover:text-ink mb-6"
      >
        <ArrowLeft className="w-4 h-4" /> Volver
      </Link>

      <Heading level={1} className="mb-6">{editId ? 'Editar reporte' : 'Nuevo reporte'}</Heading>
      {loadingExisting && (
        <Alert tone="info" hideIcon className="mb-4">
          <span className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin shrink-0" /> Cargando reporte existente...
          </span>
        </Alert>
      )}

      <StepIndicator
        steps={steps.map(s => s.title)}
        current={step}
        onStepClick={setStep}
        className="mb-8"
      />

      {error && (
        <Alert tone="danger" className="mb-4">{error}</Alert>
      )}

      <div className="bg-white rounded-card shadow-card p-6">
        {/* Step 1: Period */}
        {step === 1 && (
          <div className="space-y-4">
            <Heading level={4}>Período del reporte</Heading>
            <Field label="Nombre del período" required>
              <Input
                type="text"
                value={periodLabel}
                onChange={(e) => setPeriodLabel(e.target.value)}
                placeholder="Ej: Marzo 2026 - 1era quincena"
              />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Desde" required>
                <Input
                  type="date"
                  value={periodStart}
                  onChange={(e) => setPeriodStart(e.target.value)}
                />
              </Field>
              <Field label="Hasta" required>
                <Input
                  type="date"
                  value={periodEnd}
                  onChange={(e) => setPeriodEnd(e.target.value)}
                />
              </Field>
            </div>
          </div>
        )}

        {/* Step 2: Metrics */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <Heading level={4}>Métricas por portal</Heading>
              <label className="inline-flex items-center gap-2 text-sm bg-brand-orange/10 text-brand-orange px-3 py-2 rounded-control cursor-pointer hover:bg-brand-orange/20 transition-colors">
                <FileText className="w-4 h-4" />
                {extractingPdf ? 'Extrayendo PDF...' : 'Importar PDF KiteProp'}
                <input
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  onChange={handleKitePropPdf}
                  disabled={extractingPdf}
                />
              </label>
            </div>
            {extractingPdf && (
              <div className="flex items-center gap-2 text-sm text-brand-gray bg-brand-light p-3 rounded-control">
                <Loader2 className="w-4 h-4 animate-spin" />
                Analizando PDF de KiteProp con IA... Esto puede tomar unos segundos.
              </div>
            )}

            {metricsList.map((metrics, idx) => (
              <div key={idx} className="border border-gray-200 rounded-control p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <Select
                    value={metrics.source}
                    onChange={(e) => updateMetric(idx, 'source', e.target.value)}
                    className="w-auto font-medium"
                  >
                    <option value="zonaprop">ZonaProp</option>
                    <option value="argenprop">Argenprop</option>
                    <option value="mercadolibre">MercadoLibre</option>
                    <option value="manual">Manual</option>
                  </Select>

                  <label className="inline-flex items-center gap-2 text-sm text-brand-pink cursor-pointer hover:underline">
                    <Upload className="w-4 h-4" />
                    {extracting ? 'Extrayendo...' : 'Subir screenshot'}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleScreenshot(e, idx)}
                      disabled={extracting}
                    />
                  </label>
                </div>

                {extracting && (
                  <div className="flex items-center gap-2 text-sm text-brand-gray">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Analizando screenshot con IA...
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {[
                    { key: 'impressions', label: 'Impresiones' },
                    { key: 'portal_visits', label: 'Visitas al aviso' },
                    { key: 'inquiries', label: 'Consultas' },
                    { key: 'phone_calls', label: 'Llamadas' },
                    { key: 'whatsapp', label: 'WhatsApp' },
                    { key: 'in_person_visits', label: 'Visitas presenciales' },
                    { key: 'offers', label: 'Ofertas' },
                    { key: 'ranking_position', label: 'Posición ranking' },
                    { key: 'avg_market_price', label: 'Precio promedio zona' },
                  ].map((field) => (
                    <Field key={field.key} label={field.label}>
                      <Input
                        type="number"
                        value={(metrics as any)[field.key]}
                        onChange={(e) => updateMetric(idx, field.key, e.target.value)}
                        placeholder="0"
                      />
                    </Field>
                  ))}
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={addPortal}
              className="text-sm text-primary font-medium hover:underline"
            >
              + Agregar otro portal
            </button>
          </div>
        )}

        {/* Step 3: Content */}
        {step === 3 && (
          <div className="space-y-4">
            <Heading level={4}>Contenido del reporte</Heading>

            <Field label="Estrategia comercial">
              <Textarea
                value={strategy}
                onChange={(e) => setStrategy(e.target.value)}
                rows={3}
                placeholder="Describí la estrategia comercial aplicada..."
              />
            </Field>

            <Field label="Marketing y difusión">
              <Textarea
                value={marketing}
                onChange={(e) => setMarketing(e.target.value)}
                rows={3}
                placeholder="Detallá las acciones de marketing realizadas..."
              />
            </Field>

            <Field label="Referencia de precio">
              <Textarea
                value={priceReference}
                onChange={(e) => setPriceReference(e.target.value)}
                rows={2}
                placeholder="Comentarios sobre el precio vs mercado..."
              />
            </Field>

            <Field label="Conclusión y recomendación" required>
              <Textarea
                value={conclusion}
                onChange={(e) => setConclusion(e.target.value)}
                rows={6}
                placeholder="Análisis del desempeño y recomendaciones para el propietario..."
              />
            </Field>
          </div>
        )}

        {/* Step 4: Competitor links */}
        {step === 4 && (
          <div className="space-y-4">
            <Heading level={4}>Links de competencia</Heading>
            <Text tone="muted">Agregá links de propiedades similares que son competencia directa en la zona.</Text>

            {competitors.map((comp, idx) => (
              <div key={idx} className="border border-gray-200 rounded-control p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">Propiedad {idx + 1}</span>
                  <div className="flex items-center gap-2">
                    <label className="inline-flex items-center gap-1 text-xs text-indigo-600 cursor-pointer hover:underline bg-indigo-50 px-2 py-1 rounded">
                      <Clipboard className="w-3 h-3" />
                      {extractingComp === idx ? 'Extrayendo...' : 'Screenshot'}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        disabled={extractingComp !== null}
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) handleCompetitorScreenshot(file, idx)
                        }}
                      />
                    </label>
                    <Button variant="ghost" size="icon" aria-label="Eliminar propiedad" onClick={() => removeCompetitor(idx)} className="text-danger hover:bg-danger/10">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                {extractingComp === idx && (
                  <div className="flex items-center gap-2 text-xs text-indigo-600 bg-indigo-50 p-2 rounded">
                    <Loader2 className="w-3 h-3 animate-spin" /> Extrayendo datos con IA...
                  </div>
                )}
                <div
                  className="border-2 border-dashed border-gray-200 rounded-control p-2 text-center text-xs text-gray-400 cursor-pointer hover:border-indigo-300"
                  onPaste={(e) => {
                    const items = e.clipboardData?.items
                    if (!items) return
                    for (const item of Array.from(items)) {
                      if (item.type.startsWith('image/')) {
                        const file = item.getAsFile()
                        if (file) handleCompetitorScreenshot(file, idx)
                        break
                      }
                    }
                  }}
                  tabIndex={0}
                >
                  Pegá un screenshot aquí (Ctrl+V)
                </div>
                <Field label="URL del aviso">
                  <Input
                    type="url"
                    value={comp.url}
                    onChange={(e) => updateCompetitor(idx, 'url', e.target.value)}
                    placeholder="https://www.zonaprop.com.ar/propiedades/..."
                  />
                </Field>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Dirección">
                    <Input
                      type="text"
                      value={comp.address}
                      onChange={(e) => updateCompetitor(idx, 'address', e.target.value)}
                      placeholder="Ej: Av. Rivadavia 5200"
                    />
                  </Field>
                  <Field label="Precio (USD)">
                    <Input
                      type="number"
                      value={comp.price}
                      onChange={(e) => updateCompetitor(idx, 'price', e.target.value)}
                      placeholder="85000"
                    />
                  </Field>
                </div>
                <Field label="Notas">
                  <Input
                    type="text"
                    value={comp.notes}
                    onChange={(e) => updateCompetitor(idx, 'notes', e.target.value)}
                    placeholder="Ej: Mismo barrio, peor estado, más barato"
                  />
                </Field>
              </div>
            ))}

            <button
              type="button"
              onClick={addCompetitor}
              className="inline-flex items-center gap-2 text-sm text-primary font-medium hover:underline"
            >
              <Link2 className="w-4 h-4" /> Agregar propiedad competencia
            </button>
          </div>
        )}

        {/* Step 5: Photos */}
        {step === 5 && (
          <div className="space-y-4">
            <Heading level={4}>Fotos de fichas de visita</Heading>
            <Text tone="muted">Subí las fotos de las fichas de visita que completaron los interesados.</Text>

            <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-card p-8 cursor-pointer hover:border-brand-pink/50 transition-colors">
              <Upload className="w-8 h-8 text-brand-gray mb-2" />
              <span className="text-sm text-brand-gray">Click para seleccionar fotos</span>
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  if (e.target.files) {
                    setPhotos((prev) => [...prev, ...Array.from(e.target.files!)])
                  }
                }}
              />
            </label>

            {photos.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {photos.map((photo, i) => (
                  <div key={i} className="relative">
                    <img
                      src={URL.createObjectURL(photo)}
                      alt=""
                      className="w-full h-32 object-cover rounded-control"
                    />
                    <button
                      onClick={() => setPhotos((prev) => prev.filter((_, idx) => idx !== i))}
                      className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full text-xs flex items-center justify-center"
                    >
                      x
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step 6: Preview & Publish */}
        {step === 6 && (
          <div className="space-y-4">
            <Heading level={4}>Revisá y publicá</Heading>
            <div className="bg-brand-light rounded-control p-4 space-y-3 text-sm">
              <Text as="p"><strong>Período:</strong> {periodLabel} ({periodStart} a {periodEnd})</Text>
              <Text as="p"><strong>Portales:</strong> {metricsList.map(m => m.source).join(', ')}</Text>
              <Text as="p"><strong>Métricas cargadas:</strong>{' '}
                {metricsList.reduce((acc, m) => {
                  const filled = Object.entries(m).filter(([k, v]) => k !== 'source' && v).length
                  return acc + filled
                }, 0)} campos
              </Text>
              <Text as="p"><strong>Secciones de contenido:</strong>{' '}
                {[strategy, marketing, conclusion, priceReference].filter(Boolean).length} de 4
              </Text>
              <Text as="p"><strong>Competencia:</strong> {competitors.filter(c => c.url).length} propiedades</Text>
              <Text as="p"><strong>Fotos:</strong> {photos.length}</Text>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                fullWidth
                onClick={() => handleSubmit(false)}
                loading={loading}
              >
                {loading ? 'Guardando...' : 'Guardar como borrador'}
              </Button>
              <Button
                fullWidth
                onClick={() => handleSubmit(true)}
                loading={loading}
              >
                {loading ? 'Publicando...' : 'Publicar reporte'}
              </Button>
            </div>
          </div>
        )}

        {/* Navigation */}
        {step < 6 && (
          <div className="flex justify-between mt-6 pt-4 border-t border-gray-100">
            <Button
              variant="ghost"
              onClick={() => setStep((s) => Math.max(1, s - 1))}
              disabled={step === 1}
              icon={<ArrowLeft className="w-4 h-4" />}
            >
              Anterior
            </Button>
            <Button
              onClick={() => setStep((s) => Math.min(6, s + 1))}
            >
              Siguiente <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
