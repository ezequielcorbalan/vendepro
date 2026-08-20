'use client'
import { useState, useEffect, useCallback } from 'react'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'
import Step1Welcome from './steps/Step1Welcome'
import Step2Pipeline from './steps/Step2Pipeline'
import Step3Leads from './steps/Step3Leads'
import Step4Tasaciones from './steps/Step4Tasaciones'
import Step5Propiedades from './steps/Step5Propiedades'
import Step6Calendario from './steps/Step6Calendario'
import Step7Reportes from './steps/Step7Reportes'
import Step8Ready from './steps/Step8Ready'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Stepper } from '@/components/ui/Stepper'

const TOTAL_STEPS = 8

interface Props {
  userName: string
  onClose: () => void
}

export default function OnboardingModal({ userName, onClose }: Props) {
  const [step, setStep] = useState(1)

  useEffect(() => {
    // Flechas para navegar entre pasos. El Esc lo maneja el Modal del DS.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' && step < TOTAL_STEPS) setStep(s => s + 1)
      if (e.key === 'ArrowLeft' && step > 1) setStep(s => s - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [step])

  const goNext = useCallback(() => {
    if (step < TOTAL_STEPS) setStep(s => s + 1)
  }, [step])

  const goPrev = useCallback(() => {
    if (step > 1) setStep(s => s - 1)
  }, [step])

  const isLast = step === TOTAL_STEPS

  return (
    // ds-todo: candidato a variante "Modal con animación de entrada" — el del DS
    // no anima, así que se pierde el fade+scale que tenía este onboarding.
    <Modal
      open
      onClose={onClose}
      className="max-w-xl"
      footer={
        // El último paso trae sus propios CTA.
        isLast ? undefined : (
          <div className="flex items-center justify-between w-full">
            <Button variant="ghost" onClick={goPrev} disabled={step === 1}>
              <ChevronLeft className="w-4 h-4" aria-hidden="true" /> Anterior
            </Button>
            <Button onClick={goNext}>
              Siguiente <ChevronRight className="w-4 h-4" aria-hidden="true" />
            </Button>
          </div>
        )
      }
    >
      {/* Header propio: el Modal sólo arma el suyo si recibe `title`, y acá
          el encabezado es el indicador de pasos. Los márgenes negativos
          compensan el padding del cuerpo del Modal, para que el borde y el
          contenido de cada paso lleguen a los extremos del panel.
          ds-todo: candidato a variante "Modal con contenido a sangre". */}
      <div className="-mx-6 -mt-4 mb-4 flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <Stepper steps={TOTAL_STEPS} current={step - 1} showCount label="Progreso del tutorial" />
        <Button variant="ghost" size="sm" onClick={onClose}>
          Omitir
          <X className="w-3.5 h-3.5" aria-hidden="true" />
        </Button>
      </div>

      <div className="-mx-6 -mb-4 overflow-y-auto max-h-[70vh]">
        <StepContent step={step} userName={userName} onClose={onClose} />
      </div>
    </Modal>
  )
}

function StepContent({ step, userName, onClose }: { step: number; userName: string; onClose: () => void }) {
  switch (step) {
    case 1: return <Step1Welcome name={userName} />
    case 2: return <Step2Pipeline />
    case 3: return <Step3Leads />
    case 4: return <Step4Tasaciones />
    case 5: return <Step5Propiedades />
    case 6: return <Step6Calendario />
    case 7: return <Step7Reportes />
    case 8: return <Step8Ready name={userName} onClose={onClose} />
    default: return null
  }
}
