'use client'
import { useState, useEffect, useCallback } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { StepIndicator } from '@/components/ui/StepIndicator'
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
const TOTAL_STEPS = 8

interface Props {
  userName: string
  onClose: () => void
}

export default function OnboardingModal({ userName, onClose }: Props) {
  const [step, setStep] = useState(1)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Esc lo cierra el Modal; acá sólo la navegación por flechas.
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
    <Modal
      open
      onClose={onClose}
      className="max-w-xl h-[40rem]"
      padded={false}
      title="Bienvenida a VendéPro"
      header={<StepIndicator variant="dots" steps={TOTAL_STEPS} current={step} />}
      footer={
        // El último paso trae sus propios CTAs (Step8), así que acá no va nada.
        isLast ? undefined : (
          <div className="flex w-full items-center justify-between">
            <Button
              variant="ghost"
              onClick={goPrev}
              disabled={step === 1}
              icon={<ChevronLeft className="w-4 h-4" />}
            >
              Anterior
            </Button>
            <Button onClick={goNext}>
              Siguiente <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        )
      }
    >

        {/* El alto fijo está en el PANEL (`h-[40rem]` en el className del Modal),
            no acá: el último paso oculta el footer, así que si el alto lo llevara
            el contenido el modal seguiría cambiando de tamaño en ese paso. 40rem
            es el alto del paso más denso (Reportes); el `max-h-[90vh]` del Modal
            lo acota en pantallas bajas. El cuerpo del Modal es `grow`, así que
            este wrapper llena lo que sobra y el `m-auto` de abajo centra. */}
        <div className="flex min-h-full flex-col">
          {/* `m-auto` en vez de justify-center: centra el paso corto y, cuando
              el contenido no entra, scrollea sin recortar el borde de arriba
              (que es lo que hace justify-center con overflow). */}
          <div className="m-auto w-full">
            <StepContent step={step} userName={userName} onClose={onClose} />
          </div>
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
