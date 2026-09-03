'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { LayoutTemplate } from 'lucide-react'
import { templatesApi, landingsApi } from '@/lib/landings/api'
import type { LandingTemplate, LandingKind } from '@/lib/landings/types'
import { slugifyBase, isValidSlugBase, publicLandingHostPath } from '@/lib/landings/slug'
import { landingKindLabel } from '@/lib/landings/kind-label'
import { Field, Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { OptionCard } from '@/components/ui/OptionCard'
import { StepIndicator } from '@/components/ui/StepIndicator'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { Text } from '@/components/ui/Typography'

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
    <Modal
      open
      onClose={onClose}
      title={asTasacionTemplate ? 'Nueva plantilla de tasación' : 'Nueva landing'}
      icon={<LayoutTemplate className="w-5 h-5" />}
      padded={false}
      className="max-w-4xl max-h-[90vh] flex flex-col"
    >
        {asTasacionTemplate && (
          <div className="px-6 pt-3">
            <Badge tone="primary">Plantilla tasación</Badge>
          </div>
        )}

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
              options={(['all', 'lead_capture', 'property', 'agent_profile'] as const).map(k => ({
                value: k,
                label: kindLabel(k),
              }))}
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
    </Modal>
  )
}

// Único lugar que conoce la opción 'all' (no es parte del dominio, es del
// filtro de este modal) — el resto del mapeo lo resuelve landingKindLabel,
// compartido con LandingCard y LandingMobileInfo.
function kindLabel(kind: LandingKind | 'all'): string {
  return kind === 'all' ? 'Todos' : landingKindLabel(kind)
}
