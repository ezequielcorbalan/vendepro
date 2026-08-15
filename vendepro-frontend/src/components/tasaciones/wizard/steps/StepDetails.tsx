'use client'
import type { WizardState } from '../use-wizard-form'
import { Field, Input, Textarea } from '@/components/ui/Input'

interface Props {
  details: WizardState['details']
  onPatchDetails: (patch: Partial<WizardState['details']>) => void
}

export function StepDetails({ details, onPatchDetails }: Props) {
  return (
    <div className="space-y-8">
      {/* SWOT */}
      <section className="space-y-4">
        <h3 className="text-base font-semibold text-ink">Análisis FODA</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {(
            [
              { key: 'strengths', label: 'Fortalezas' },
              { key: 'weaknesses', label: 'Debilidades' },
              { key: 'opportunities', label: 'Oportunidades' },
              { key: 'threats', label: 'Amenazas' },
            ] as const
          ).map(({ key, label }) => (
            <Field key={key} label={label}>
              <Textarea
                rows={3}
                value={details[key] ?? ''}
                onChange={(e) => onPatchDetails({ [key]: e.target.value || null })}
              />
            </Field>
          ))}
        </div>
      </section>

      {/* Prices */}
      <section className="space-y-4">
        <h3 className="text-base font-semibold text-ink">Valuación</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Precio sugerido (USD)">
            <Input
              type="number"
              min={0}
              value={details.suggested_price ?? ''}
              onChange={(e) =>
                onPatchDetails({ suggested_price: e.target.value ? Number(e.target.value) : null })
              }
            />
          </Field>
          <Field label="Precio de prueba (USD)">
            <Input
              type="number"
              min={0}
              value={details.test_price ?? ''}
              onChange={(e) =>
                onPatchDetails({ test_price: e.target.value ? Number(e.target.value) : null })
              }
            />
          </Field>
          <Field label="Precio de cierre esperado (USD)">
            <Input
              type="number"
              min={0}
              value={details.expected_close_price ?? ''}
              onChange={(e) =>
                onPatchDetails({ expected_close_price: e.target.value ? Number(e.target.value) : null })
              }
            />
          </Field>
          <Field label="USD/m²">
            <Input
              type="number"
              min={0}
              value={details.usd_per_m2 ?? ''}
              onChange={(e) =>
                onPatchDetails({ usd_per_m2: e.target.value ? Number(e.target.value) : null })
              }
            />
          </Field>
        </div>
      </section>
    </div>
  )
}
