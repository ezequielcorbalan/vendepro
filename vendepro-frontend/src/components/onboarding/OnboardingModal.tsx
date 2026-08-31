'use client'
import { useState, useEffect, useCallback } from 'react'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'
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
const TOTAL_STEPS = 8

interface Props {
  userName: string
  onClose: () => void
}

export default function OnboardingModal({ userName, onClose }: Props) {
  const [step, setStep] = useState(1)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Trigger fade-in on mount
    const t = setTimeout(() => setVisible(true), 10)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' && step < TOTAL_STEPS) setStep(s => s + 1)
      if (e.key === 'ArrowLeft' && step > 1) setStep(s => s - 1)
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [step, onClose])

  const goNext = useCallback(() => {
    if (step < TOTAL_STEPS) setStep(s => s + 1)
  }, [step])

  const goPrev = useCallback(() => {
    if (step > 1) setStep(s => s - 1)
  }, [step])

  const isLast = step === TOTAL_STEPS

  return (
    <div
      className={`fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4 transition-opacity duration-300 ${visible ? 'opacity-100' : 'opacity-0'}`}
      onClick={onClose}
    >
      <div
        className={`bg-white rounded-card w-full max-w-xl h-[34rem] shadow-pop flex flex-col overflow-hidden transition-all duration-300 ${visible ? 'scale-100' : 'scale-95'}`}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <StepIndicator variant="dots" steps={TOTAL_STEPS} current={step} />
          <Button variant="ghost" size="sm" onClick={onClose} className="text-xs text-gray-400">
            Omitir <X className="w-3.5 h-3.5" />
          </Button>
        </div>

        {/* El alto fijo está en el PANEL (h-[34rem]), no acá: el último paso
            oculta el footer, así que si el alto lo llevara el contenido el modal
            seguiría cambiando de tamaño en ese paso. El contenido toma lo que
            sobra y scrollea si hace falta. */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          <StepContent step={step} userName={userName} onClose={onClose} />
        </div>

        {/* Footer nav — hidden on last step (Step8 has its own CTAs) */}
        {!isLast && (
          <div className="flex items-center justify-between px-5 py-4 border-t border-gray-100 bg-gray-50/50">
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
        )}
      </div>
    </div>
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
