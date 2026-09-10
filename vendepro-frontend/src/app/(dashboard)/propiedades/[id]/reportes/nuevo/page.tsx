'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, ArrowRight, Upload, Check, Loader2, FileText, Link2, Trash2, Clipboard, Sparkles } from 'lucide-react'
import type { MetricSource, ExtractedMetrics } from '@/lib/types'
import { apiFetch } from '@/lib/api'
import { fileToBase64, extractComparableFromImage } from '@/components/tasaciones/shared/extract-comparable'
import { Alert } from '@/components/ui/Alert'
import { Field, Input, Textarea, Select } from '@/components/ui/Input'
import { Heading, Text } from '@/components/ui/Typography'
import { Button } from '@/components/ui/Button'
import { StepIndicator } from '@/components/ui/StepIndicator'
import { useConfirm } from '@/components/ui/useConfirm'

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
  // Si el reporte que se edita YA está publicado: guardarlo "como borrador" lo
  // DESPUBLICA y el link /r/ que el propietario tiene deja de andar. Pasó en
  // producción (2026-09-10): edición + botón equivocado = 404 para el cliente.
  const [wasPublished, setWasPublished] = useState(false)
  const { confirmDialog, askConfirm } = useConfirm()

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
  // Fotos ya guardadas del reporte (solo en modo edición)
  const [existingPhotos, setExistingPhotos] = useState<{ id: string; photo_url: string }[]>([])
  const [deletingPhoto, setDeletingPhoto] = useState<string | null>(null)

  // Competitor extraction
  const [extractingComp, setExtractingComp] = useState<number | null>(null)
  const [extractingUrl, setExtractingUrl] = useState<number | null>(null)

  // KiteProp PDF extraction
  const [extractingPdf, setExtractingPdf] = useState(false)

  // Sugerencia de conclusión con IA (paso 3)
  const [suggesting, setSuggesting] = useState(false)

  // Load existing report if editing
  useEffect(() => {
    if (!editId) return
    apiFetch('properties', `/reports/${editId}`)
      .then(r => r.json() as Promise<any>)
      .then(data => {
        if (data.error) { setError(data.error); setLoadingExisting(false); return }
        const rep = data.report || {}
        setWasPublished(rep.status === 'published')
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

        if (Array.isArray(data.photos)) {
          setExistingPhotos(data.photos.map((p: any) => ({ id: p.id, photo_url: p.photo_url })))
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
    // Permite volver a elegir el mismo archivo si el primer intento falló.
    e.target.value = ''
    if (!file) return
    setExtractingPdf(true)
    setError('')
    try {
      // JSON con el PDF en base64, igual que /extract-metrics y /extract-comparable.
      // Antes iba como multipart con el campo `pdf` a una ruta que no existía
      // en api-ai: todos los intentos morían con 404.
      const { base64 } = await fileToBase64(file)
      const response = await apiFetch('ai', '/extract-kiteprop', {
        method: 'POST',
        body: JSON.stringify({ pdfBase64: base64 }),
      })
      const data = (await response.json().catch(() => ({}))) as any
      if (!response.ok) {
        throw new Error(data?.error || `Error al extraer datos del PDF (HTTP ${response.status})`)
      }

      // Auto-fill metrics from KiteProp data
      if (data.portals && data.portals.length > 0) {
        const newMetrics = data.portals.map((p: any) => ({
          ...defaultMetrics,
          source: p.source || 'manual',
          impressions: p.impressions?.toString() || '',
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
      console.error('[extract-kiteprop] fallo la extraccion:', err)
      setError(
        `No se pudieron extraer los datos del PDF de KiteProp. Cargalos manualmente. (${(err as Error)?.message ?? 'error desconocido'})`,
      )
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

  /** Vuelca un comparable extraído por IA sobre la fila `index`, sin pisar lo cargado con vacíos. */
  function applyExtractedCompetitor(index: number, fields: any) {
    setCompetitors((prev) => {
      const updated = [...prev]
      updated[index] = {
        ...updated[index],
        url: fields.zonaprop_url || updated[index].url,
        address: fields.address || updated[index].address,
        price: fields.price?.toString() || updated[index].price,
        notes: [
          fields.total_area ? `${fields.total_area}m²` : '',
          fields.usd_per_m2 ? `${fields.usd_per_m2} USD/m²` : '',
          fields.days_on_market ? `${fields.days_on_market}d` : '',
          fields.views_per_day ? `${fields.views_per_day} vistas/d` : '',
        ].filter(Boolean).join(' · ') || updated[index].notes,
      }
      return updated
    })
  }

  async function handleCompetitorScreenshot(file: File, index: number) {
    setExtractingComp(index)
    setError('')
    try {
      // Reusa /extract-comparable, el mismo endpoint que ya usan las
      // tasaciones. Antes esto iba como multipart a /extract-zonaprop, una
      // ruta que no existe en api-ai: todos los intentos morían con 404.
      const fields = await extractComparableFromImage(file)
      applyExtractedCompetitor(index, fields)
    } catch (err) {
      console.error('[extract-comparable] fallo la extraccion:', err)
      setError(`No se pudieron extraer datos del screenshot. (${(err as Error)?.message ?? 'error desconocido'})`)
    } finally {
      setExtractingComp(null)
    }
  }

  async function handleDeleteExistingPhoto(photoId: string) {
    setDeletingPhoto(photoId)
    try {
      const res = await apiFetch('properties', `/report-photos/${photoId}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as any
        throw new Error(data?.error || 'No se pudo borrar la foto')
      }
      setExistingPhotos((prev) => prev.filter((p) => p.id !== photoId))
    } catch (err) {
      setError((err as Error)?.message ?? 'No se pudo borrar la foto')
    } finally {
      setDeletingPhoto(null)
    }
  }

  /** Camino "pegá el link": el backend baja la página del aviso y extrae los datos. */
  async function handleCompetitorUrl(index: number) {
    const url = competitors[index]?.url?.trim()
    if (!url) {
      setError('Pegá primero el link del aviso en el campo URL.')
      return
    }
    setExtractingUrl(index)
    setError('')
    try {
      const res = await apiFetch('ai', '/extract-comparable-url', {
        method: 'POST',
        body: JSON.stringify({ url }),
      })
      const data = (await res.json().catch(() => ({}))) as any
      if (!res.ok) {
        throw new Error(data?.error || `Error al leer el aviso (HTTP ${res.status})`)
      }
      applyExtractedCompetitor(index, data.fields ?? {})
    } catch (err) {
      console.error('[extract-comparable-url] fallo la extraccion:', err)
      setError((err as Error)?.message ?? 'No se pudo leer el aviso desde el link.')
    } finally {
      setExtractingUrl(null)
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
      // JSON con la imagen en base64, igual que /extract-comparable y
      // /extract-image. Antes iba como multipart con el campo `screenshot`,
      // pero la ruta hace `c.req.json()`: reventaba parseando y devolvia 500
      // sin llegar nunca al proveedor.
      const { base64, mimeType } = await fileToBase64(file)

      const response = await apiFetch('ai', '/extract-metrics', {
        method: 'POST',
        body: JSON.stringify({ imageBase64: base64, mimeType }),
      })

      const payload = (await response.json().catch(() => ({}))) as any
      if (!response.ok) {
        throw new Error(payload?.error || `Error al extraer datos (HTTP ${response.status})`)
      }

      // La ruta responde `{ metrics }`, no los campos planos.
      const extracted: ExtractedMetrics = payload.metrics ?? {}

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
      // El catch mudo de antes ocultó tres bugs de contrato durante meses: el
      // usuario leia "cargalos manualmente" y asumia que la IA no habia podido
      // con SU captura.
      console.error('[extract-metrics] fallo la extraccion:', err)
      setError(
        `No se pudieron extraer los datos del screenshot. Cargalos manualmente. (${(err as Error)?.message ?? 'error desconocido'})`,
      )
    } finally {
      setExtracting(false)
    }
  }

  /** Redacta la conclusión con IA a partir de las métricas y la competencia ya cargadas. */
  async function handleSuggestConclusion() {
    setSuggesting(true)
    setError('')
    try {
      const res = await apiFetch('ai', '/suggest-report-conclusion', {
        method: 'POST',
        body: JSON.stringify({
          periodLabel,
          periodStart,
          periodEnd,
          metrics: metricsList,
          competitors,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as any
      if (!res.ok) {
        throw new Error(data?.error || `Error al generar la conclusión (HTTP ${res.status})`)
      }
      if (data.conclusion) setConclusion(data.conclusion)
      // La referencia de precio sólo se completa si el campo está vacío:
      // es secundaria y no queremos pisar texto que el agente ya escribió.
      if (data.price_reference && !priceReference.trim()) setPriceReference(data.price_reference)
    } catch (err) {
      console.error('[suggest-conclusion] fallo la generacion:', err)
      setError((err as Error)?.message ?? 'No se pudo generar la conclusión.')
    } finally {
      setSuggesting(false)
    }
  }

  async function handleSubmit(publish: boolean) {
    if (!publish && wasPublished) {
      const { confirmed } = await askConfirm({
        title: 'Despublicar el reporte',
        message: 'Este reporte está publicado: si lo guardás como borrador, el link público que tiene el propietario va a dejar de funcionar hasta que lo vuelvas a publicar. ¿Despublicar igual?',
        confirmLabel: 'Sí, despublicar',
        cancelLabel: 'Volver',
      })
      if (!confirmed) return
    }
    // Los "required" de los pasos 1 y 3 no se validaban en ningún lado: se
    // podía publicar un reporte sin período (slug "reporte-periodo-…") y sin
    // conclusión. El stepper deja saltar pasos, así que la red va acá.
    if (!periodLabel.trim() || !periodStart || !periodEnd) {
      setError('Completá el período del reporte (nombre, desde y hasta) antes de guardar.')
      setStep(1)
      return
    }
    if (periodEnd < periodStart) {
      setError('La fecha "Hasta" no puede ser anterior a "Desde".')
      setStep(1)
      return
    }
    if (publish && !conclusion.trim()) {
      setError('Escribí la conclusión y recomendación antes de publicar.')
      setStep(3)
      return
    }
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
          photoForm.append('sortOrder', (existingPhotos.length + i).toString())
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
      {confirmDialog}
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

            <div>
              {/* Field no tiene slot de acción junto al label; el label vive acá
                  afuera (mismas clases que el de Field) y la asociación se
                  mantiene por htmlFor. ds-todo: candidato a prop "action" en Field */}
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="conclusion-ai" className="text-sm font-medium text-gray-700">
                  Conclusión y recomendación<span className="text-danger ml-0.5">*</span>
                </label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSuggestConclusion}
                  loading={suggesting}
                  disabled={suggesting}
                  icon={<Sparkles className="w-4 h-4" />}
                >
                  {suggesting ? 'Redactando...' : 'Sugerir con IA'}
                </Button>
              </div>
              <Field htmlFor="conclusion-ai">
              <Textarea
                value={conclusion}
                onChange={(e) => setConclusion(e.target.value)}
                rows={6}
                placeholder="Análisis del desempeño y recomendaciones para el propietario... o tocá «Sugerir con IA» y editá el borrador."
              />
              </Field>
              {suggesting && (
                <div className="flex items-center gap-2 text-sm text-brand-gray mt-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Analizando las métricas cargadas y redactando el borrador...
                </div>
              )}
            </div>
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
                  <div className="flex gap-2">
                    <Input
                      type="url"
                      value={comp.url}
                      onChange={(e) => updateCompetitor(idx, 'url', e.target.value)}
                      placeholder="https://www.zonaprop.com.ar/propiedades/..."
                      className="flex-1"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCompetitorUrl(idx)}
                      loading={extractingUrl === idx}
                      disabled={extractingUrl !== null || !comp.url.trim()}
                      icon={<Sparkles className="w-4 h-4" />}
                      className="shrink-0 self-center"
                    >
                      {extractingUrl === idx ? 'Leyendo...' : 'Extraer del link'}
                    </Button>
                  </div>
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

            {existingPhotos.length > 0 && (
              <div>
                <Text size="xs" tone="muted" className="mb-2">Fotos ya guardadas ({existingPhotos.length})</Text>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {existingPhotos.map((photo) => (
                    <div key={photo.id} className="relative">
                      <img
                        src={photo.photo_url}
                        alt=""
                        className="w-full h-32 object-cover rounded-control"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteExistingPhoto(photo.id)}
                        loading={deletingPhoto === photo.id}
                        aria-label="Borrar foto guardada"
                        className="absolute top-1 right-1 w-6 h-6 p-0 bg-danger text-white rounded-full hover:bg-danger/80 hover:text-white"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

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
              <Text as="p"><strong>Fotos:</strong> {existingPhotos.length + photos.length}{existingPhotos.length > 0 ? ` (${existingPhotos.length} ya guardadas)` : ''}</Text>
            </div>

            {wasPublished && (
              <Alert tone="info">
                Este reporte ya está publicado. "Guardar cambios" actualiza lo que ve el
                propietario manteniendo el mismo link.
              </Alert>
            )}
            <div className="flex gap-3">
              <Button
                variant="outline"
                fullWidth
                onClick={() => handleSubmit(false)}
                loading={loading}
              >
                {loading ? 'Guardando...' : wasPublished ? 'Despublicar (apaga el link)' : 'Guardar como borrador'}
              </Button>
              <Button
                fullWidth
                onClick={() => handleSubmit(true)}
                loading={loading}
              >
                {loading ? 'Publicando...' : wasPublished ? 'Guardar cambios' : 'Publicar reporte'}
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
