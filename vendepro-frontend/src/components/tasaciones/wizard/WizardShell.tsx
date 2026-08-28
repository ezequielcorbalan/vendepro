'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ArrowRight, Loader2 } from 'lucide-react'
import { useWizardForm, canAdvance, type WizardStep } from './use-wizard-form'
import { StepTemplate } from './steps/StepTemplate'
import { StepProperty } from './steps/StepProperty'
import { StepVariableBlocks } from './steps/StepVariableBlocks'
import { StepDetails } from './steps/StepDetails'
import { StepCompetencia } from './steps/StepCompetencia'
import { StepReview } from './steps/StepReview'
import { createAppraisal, updateAppraisal, publishAppraisal, syncTemplate, addComparable, deleteComparable, patchBlockOverride } from '../shared/api'
import { APPRAISAL_BLOCK_TYPES, type AppraisalBlockType } from '../renderer/types'
import { useToast } from '@/components/ui/Toast'
import { StepIndicator } from '@/components/ui/StepIndicator'
import type { WizardState } from './use-wizard-form'

interface Props {
  initialTemplateId?: string | null
  initialLeadId?: string | null
  /** Modo edición: ID de la tasación existente. */
  existingAppraisalId?: string
  /** IDs de los comparables existentes — se borran y recrean al guardar. */
  existingComparableIds?: string[]
  /** Estado inicial pre-cargado desde la tasación existente. */
  initialData?: Partial<WizardState>
}

const STEP_LABELS = ['Template', 'Propiedad', 'Bloques', 'FODA + Precios', 'Comparables', 'Revisar']
const TOTAL_STEPS = STEP_LABELS.length

export function WizardShell({ initialTemplateId, initialLeadId, existingAppraisalId, existingComparableIds = [], initialData }: Props) {
  const isEditMode = !!existingAppraisalId
  const [state, dispatch] = useWizardForm(
    initialData ?? {
      template_id: initialTemplateId ?? null,
      lead_id: initialLeadId ?? null,
      step: initialTemplateId ? 2 : 1,
    }
  )
  const [publishing, setPublishing] = useState(false)
  const router = useRouter()
  const { toast } = useToast()

  // Permite saltar a cualquier etapa desde el stepper. Hacia atrás siempre se
  // puede; hacia adelante exige la dirección (único campo obligatorio, igual
  // que canAdvance en el paso 2).
  const goToStep = (n: WizardStep) => {
    if (n === state.step) return
    if (n > state.step && !state.property.address.trim()) {
      toast('Completá la dirección antes de avanzar', 'error')
      dispatch({ type: 'goto', step: 2 })
      return
    }
    dispatch({ type: 'goto', step: n })
  }

  const buildCustomSnapshot = () => {
    if (!state.template_id && state.customBlocks.length > 0) {
      const orderOf = (t: AppraisalBlockType) => APPRAISAL_BLOCK_TYPES.indexOf(t)
      const sorted = [...state.customBlocks].sort((a, b) => orderOf(a.type) - orderOf(b.type))
      return sorted.map((b, i) => ({
        id: `custom-${b.type}`,
        type: b.type,
        binding_mode: 'tasacion',
        include_in_pdf: true,
        sort_order: i,
        data: b.data,
      }))
    }
    return null
  }

  const saveOverrides = async (appraisalId: string) => {
    const overrideEntries = Object.entries(state.blockOverrides).filter(
      ([, patch]) => patch && Object.keys(patch).length > 0,
    )
    if (overrideEntries.length > 0) {
      await Promise.all(
        overrideEntries.map(([blockId, patch]) => patchBlockOverride(appraisalId, blockId, patch)),
      )
    }
  }

  const handleSaveEdit = async () => {
    setPublishing(true)
    if (!state.property.address.trim()) {
      toast('La dirección es obligatoria', 'error')
      dispatch({ type: 'goto', step: 2 })
      setPublishing(false)
      return
    }
    try {
      const { address, ...restProperty } = state.property
      const customSnapshot = buildCustomSnapshot()
      await updateAppraisal(existingAppraisalId!, {
        template_id: state.template_id,
        ...(customSnapshot ? { template_snapshot_json: customSnapshot } : {}),
        property_address: address,
        ...restProperty,
        lead_id: state.lead_id,
        ...state.details,
      })
      if (state.template_id) {
        await syncTemplate(existingAppraisalId!)
      }
      if (existingComparableIds.length > 0) {
        await Promise.all(existingComparableIds.map(cid => deleteComparable(cid)))
      }
      for (let i = 0; i < state.comparables.length; i++) {
        await addComparable({ ...state.comparables[i], sort_order: i, appraisal_id: existingAppraisalId! })
      }
      await saveOverrides(existingAppraisalId!)
      router.push(`/tasaciones/${existingAppraisalId}/editar`)
    } catch (e: any) {
      toast(e?.message ?? 'Error al guardar', 'error')
      setPublishing(false)
    }
  }

  const handlePublish = async (publishPublic: boolean) => {
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
      const customSnapshot = buildCustomSnapshot()
      const { id } = await createAppraisal({
        template_id: state.template_id,
        ...(customSnapshot ? { template_snapshot_json: customSnapshot } : {}),
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
      await saveOverrides(id)
      if (publishPublic) await publishAppraisal(id)
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
        <h1 className="text-2xl font-bold text-ink">{isEditMode ? 'Editar tasación' : 'Nueva tasación'}</h1>
        <button
          onClick={() => isEditMode ? router.push(`/tasaciones/${existingAppraisalId}/editar`) : router.back()}
          className="text-sm text-slate-500 hover:text-slate-700"
        >
          {isEditMode ? 'Volver al editor' : 'Cancelar'}
        </button>
      </header>

      <StepIndicator
        steps={STEP_LABELS}
        current={state.step}
        onStepClick={n => goToStep(n as WizardStep)}
        allowForward
        className="mb-8"
      />

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
          <StepVariableBlocks
            templateId={state.template_id}
            overrides={state.blockOverrides}
            onPatchOverride={(blockId, patch) =>
              dispatch({ type: 'patch_block_override', blockId, patch })
            }
            customBlocks={state.customBlocks}
            onToggleCustomBlock={(blockType) =>
              dispatch({ type: 'toggle_custom_block', blockType })
            }
            onPatchCustomBlock={(blockType, patch) =>
              dispatch({ type: 'patch_custom_block', blockType, patch })
            }
          />
        )}
        {state.step === 4 && (
          <StepDetails
            details={state.details}
            onPatchDetails={(p) => dispatch({ type: 'patch_details', patch: p })}
          />
        )}
        {state.step === 5 && (
          <StepCompetencia
            comparables={state.comparables}
            onAddComparable={(c) => dispatch({ type: 'add_comparable', comparable: c })}
            onPatchComparable={(i, patch) => dispatch({ type: 'patch_comparable', index: i, patch })}
            onRemoveComparable={(i) => dispatch({ type: 'remove_comparable', index: i })}
            onMoveComparable={(i, delta) => dispatch({ type: 'move_comparable', index: i, delta })}
          />
        )}
        {state.step === 6 && (
          <StepReview
            templateId={state.template_id}
            property={state.property}
            details={state.details}
            comparables={state.comparables}
            customBlocks={state.customBlocks}
            blockOverrides={state.blockOverrides}
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

        {state.step < TOTAL_STEPS ? (
          <button
            onClick={() => dispatch({ type: 'next' })}
            disabled={!canAdvance(state)}
            className="flex items-center gap-2 rounded bg-gradient-to-br from-brand-pink to-brand-orange px-5 py-2 text-sm text-white disabled:opacity-40"
          >
            Siguiente <ArrowRight className="h-4 w-4" />
          </button>
        ) : isEditMode ? (
          <button
            onClick={handleSaveEdit}
            disabled={publishing}
            className="flex items-center gap-2 rounded bg-gradient-to-br from-brand-pink to-brand-orange px-5 py-2 text-sm text-white disabled:opacity-40"
          >
            {publishing && <Loader2 className="h-4 w-4 animate-spin" />}
            Guardar cambios
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={() => handlePublish(false)}
              disabled={publishing}
              className="flex items-center gap-2 rounded border border-slate-300 bg-white px-5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            >
              {publishing && <Loader2 className="h-4 w-4 animate-spin" />}
              Guardar borrador
            </button>
            <button
              onClick={() => handlePublish(true)}
              disabled={publishing}
              className="flex items-center gap-2 rounded bg-gradient-to-br from-brand-pink to-brand-orange px-5 py-2 text-sm text-white disabled:opacity-40"
            >
              {publishing && <Loader2 className="h-4 w-4 animate-spin" />}
              Publicar
            </button>
          </div>
        )}
      </footer>
    </div>
  )
}
