'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { X } from 'lucide-react'
import { templatesApi, landingsApi } from '@/lib/landings/api'
import type { LandingTemplate, LandingKind } from '@/lib/landings/types'
import { slugifyBase, isValidSlugBase, publicLandingHostPath } from '@/lib/landings/slug'
import { Field, Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { OptionCard } from '@/components/ui/OptionCard'
import { StepIndicator } from '@/components/ui/StepIndicator'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { Heading, Text } from '@/components/ui/Typography'

type Step = 'template' | 'name'

export default function NewLandingModal({ onClose, asTasacionTemplate = false }: { onClose: () => void; asTasacionTemplate?: boolean }) {
  const router = useRouter()
  const [step, setStep] = useState<Step>('template')
  const [templates, setTemplates] = useState<LandingTemplate[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<LandingTemplate | null>(null)
  const [kindFilter, setKindFilter] = useState<LandingKind | 'all'>('all')
  const [loading, setLoading] = useState(true)
  const [slugBase, setSlugBase] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    templatesApi.list().then(r => setTemplates(r.templates)).finally(() => setLoading(false))
  }, [])

  const filtered = kindFilter === 'all' ? templates : templates.filter(t => t.kind === kindFilter)

  async function submit() {
    if (!selectedTemplate) return
    const normalized = slugifyBase(slugBase)
    if (!isValidSlugBase(normalized)) {
      setError('El slug debe tener 3-60 caracteres, solo letras, números y guiones.')
      return
    }
    setCreating(true); setError(null)
    try {
      const r = await landingsApi.create({
        templateId: selectedTemplate.id,
        slugBase: normalized,
        ...(asTasacionTemplate ? { templateType: 'tasacion' as const } : {}),
      })
      router.push(`/landings/${r.landingId}`)
    } catch (e: any) {
      setError(e.message ?? 'No se pudo crear la landing.')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-card w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-pop flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Heading level={3}>
              {asTasacionTemplate ? 'Nueva plantilla de tasación' : 'Nueva landing'}
            </Heading>
            {asTasacionTemplate && <Badge tone="primary">Plantilla tasación</Badge>}
          </div>
          <Button variant="ghost" size="icon" aria-label="Cerrar" onClick={onClose}><X className="w-5 h-5" /></Button>
        </div>

        <div className="px-6 py-3 border-b border-gray-100">
          <StepIndicator
            steps={['Elegí un template', 'Nombrala']}
            current={step === 'template' ? 1 : 2}
          />
        </div>

        {step === 'template' && (
          <div className="flex-1 overflow-auto p-6">
            <SegmentedControl
              className="mb-4"
              value={kindFilter}
              onChange={v => setKindFilter(v as typeof kindFilter)}
              options={[
                { value: 'all', label: 'Todos' },
                { value: 'lead_capture', label: 'Captación' },
                { value: 'property', label: 'Propiedad' },
              ]}
            />
            {loading ? (
              <Text tone="muted" className="text-center py-12">Cargando templates…</Text>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {filtered.map(t => (
                  <OptionCard
                    key={t.id}
                    orientation="stack"
                    onClick={() => { setSelectedTemplate(t); setStep('name') }}
                    selected={selectedTemplate?.id === t.id}
                    media={
                      <div className="aspect-[16/10] bg-gray-100 flex items-center justify-center text-gray-400">
                        {t.preview_image_url
                          ? <img src={t.preview_image_url} alt="" className="w-full h-full object-cover" />
                          : <span className="text-xs">Sin preview</span>}
                      </div>
                    }
                    title={t.name}
                    description={t.description ?? undefined}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {step === 'name' && selectedTemplate && (
          <div className="flex-1 overflow-auto p-6">
            <Text size="sm" tone="muted" className="mb-6">Template elegido: <strong className="text-ink">{selectedTemplate.name}</strong></Text>

            <Field label="Nombre / slug de la landing">
              <Input
                autoFocus
                value={slugBase}
                onChange={e => setSlugBase(e.target.value)}
                placeholder="ej: palermo-soho"
              />
            </Field>
            {slugBase && (
              <Text size="xs" tone="muted" className="mt-2">
                URL final: <code>{publicLandingHostPath(`${slugifyBase(slugBase) || 'slug'}-XXXXX`)}</code> (se agrega un sufijo aleatorio de 5 chars)
              </Text>
            )}
            {error && <Text size="sm" tone="danger" className="mt-3">{error}</Text>}

            <div className="flex items-center justify-between mt-8">
              <Button variant="ghost" onClick={() => setStep('template')}>← Volver</Button>
              <Button
                size="lg"
                onClick={submit}
                loading={creating}
                disabled={!slugBase.trim()}
                className="rounded-full px-6"
              >
                {creating ? 'Creando…' : 'Crear landing'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
