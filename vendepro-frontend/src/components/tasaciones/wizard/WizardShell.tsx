'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ArrowRight, Loader2 } from 'lucide-react'
import { useWizardForm, canAdvance } from './use-wizard-form'
import { StepTemplate } from './steps/StepTemplate'
import { StepProperty } from './steps/StepProperty'
import { StepDetails } from './steps/StepDetails'
import { StepCompetencia } from './steps/StepCompetencia'
import { StepReview } from './steps/StepReview'
import { createAppraisal, publishAppraisal, addComparable } from '../shared/api'
import { useToast } from '@/components/ui/Toast'

interface Props {
  initialTemplateId?: string | null
}

const STEP_LABELS = ['Template', 'Propiedad', 'FODA + Precios', 'Competencia', 'Revisar']

export function WizardShell({ initialTemplateId }: Props) {
  const [state, dispatch] = useWizardForm({
    template_id: initialTemplateId ?? null,
    step: initialTemplateId ? 2 : 1,
  })
  const [publishing, setPublishing] = useState(false)
  const router = useRouter()
  const { toast } = useToast()

  const handlePublish = async () => {
    setPublishing(true)
    if (!state.property.address.trim()) {
      toast('La dirección es obligatoria', 'error')
      dispatch({ type: 'goto', step: 2 })
      setPublishing(false)
      return
    }
    let appraisalId: string | null = null
    try {
      const { address, ...restProperty } = state.property
      const { id } = await createAppraisal({
        template_id: state.template_id,
        property_id: state.property_id,
        property_address: address,
        ...restProperty,
        lead_id: state.lead_id,
        ...state.details,
      })
      appraisalId = id
      for (let i = 0; i < state.comparables.length; i++) {
        await addComparable({ ...state.comparables[i], sort_order: i, appraisal_id: id })
      }
      if (state.publish.generate_public_slug) await publishAppraisal(id)
      router.push(`/tasaciones/${id}/editar?welcome=1`)
    } catch (e: any) {
      const msg = e?.message ?? 'Error al publicar'
      if (appraisalId) {
        toast('Tasación creada pero algo falló — continuá desde el editor', 'error')
        router.push(`/tasaciones/${appraisalId}/editar?partial=1`)
      } else {
        toast(msg, 'error')
        setPublishing(false)
      }
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 md:px-8 md:py-10">
      {/* Header */}
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Nueva tasación</h1>
        <button
          onClick={() => router.back()}
          className="text-sm text-slate-500 hover:text-slate-700"
        >
          Cancelar
        </button>
      </header>

      {/* Stepper */}
      <div className="mb-8 flex gap-2">
        {STEP_LABELS.map((label, i) => {
          const n = (i + 1) as 1 | 2 | 3 | 4 | 5
          const done = n < state.step
          const active = n === state.step
          return (
            <div
              key={i}
              className={`flex-1 rounded px-3 py-2 text-center text-xs font-medium ${
                active
                  ? 'bg-[#ff007c] text-white'
                  : done
                  ? 'bg-slate-200 text-slate-700'
                  : 'bg-slate-100 text-slate-400'
              }`}
            >
              {done && '✓ '}
              {n}. {label}
            </div>
          )
        })}
      </div>

      {/* Step body */}
      <div className="min-h-[50vh]">
        {state.step === 1 && (
          <StepTemplate
            selectedId={state.template_id}
            onSelect={(id) => dispatch({ type: 'set_template', id })}
          />
        )}
        {state.step === 2 && (
          <StepProperty
            property={state.property}
            propertyId={state.property_id}
            leadId={state.lead_id}
            onPatchProperty={(p) => dispatch({ type: 'patch_property', patch: p })}
            onSetPropertyId={(id) => dispatch({ type: 'set_property_id', id })}
            onSetLead={(id) => dispatch({ type: 'set_lead', id })}
          />
        )}
        {state.step === 3 && (
          <StepDetails
            details={state.details}
            onPatchDetails={(p) => dispatch({ type: 'patch_details', patch: p })}
          />
        )}
        {state.step === 4 && (
          <StepCompetencia
            comparables={state.comparables}
            onAddComparable={(c) => dispatch({ type: 'add_comparable', comparable: c })}
            onPatchComparable={(i, patch) => dispatch({ type: 'patch_comparable', index: i, patch })}
            onRemoveComparable={(i) => dispatch({ type: 'remove_comparable', index: i })}
          />
        )}
        {state.step === 5 && (
          <StepReview
            templateId={state.template_id}
            property={state.property}
            details={state.details}
            comparables={state.comparables}
            generatePublicSlug={state.publish.generate_public_slug}
            onTogglePublicSlug={() => dispatch({ type: 'toggle_public_slug' })}
          />
        )}
      </div>

      {/* Footer */}
      <footer className="mt-8 flex justify-between border-t border-slate-200 pt-6">
        <button
          onClick={() => dispatch({ type: 'back' })}
          disabled={state.step === 1}
          className="flex items-center gap-2 rounded px-4 py-2 text-sm text-slate-600 disabled:opacity-40"
        >
          <ArrowLeft className="h-4 w-4" /> Atrás
        </button>

        {state.step < 5 ? (
          <button
            onClick={() => dispatch({ type: 'next' })}
            disabled={!canAdvance(state)}
            className="flex items-center gap-2 rounded bg-[#ff007c] px-5 py-2 text-sm text-white disabled:opacity-40"
          >
            Siguiente <ArrowRight className="h-4 w-4" />
          </button>
        ) : (
          <button
            onClick={handlePublish}
            disabled={publishing}
            className="flex items-center gap-2 rounded bg-[#ff007c] px-5 py-2 text-sm text-white disabled:opacity-40"
          >
            {publishing && <Loader2 className="h-4 w-4 animate-spin" />}
            {state.publish.generate_public_slug ? 'Publicar' : 'Guardar borrador'}
          </button>
        )}
      </footer>
    </div>
  )
}
