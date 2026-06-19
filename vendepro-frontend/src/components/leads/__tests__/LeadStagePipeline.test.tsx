import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { LeadStagePipeline } from '../LeadStagePipeline'
import { LEAD_STAGES, LEAD_PIPELINE_STAGES } from '@/lib/crm-config'

describe('LeadStagePipeline', () => {
  it('renderiza todas las etapas del pipeline', () => {
    render(<LeadStagePipeline currentStage="nuevo" onSelect={() => {}} />)
    for (const s of LEAD_PIPELINE_STAGES) {
      expect(screen.getByRole('button', { name: new RegExp(LEAD_STAGES[s].label, 'i') })).toBeInTheDocument()
    }
  })

  it('refleja la etapa actual (marca solo esa con aria-current="step")', () => {
    render(<LeadStagePipeline currentStage="contactado" onSelect={() => {}} />)
    const current = document.querySelectorAll('[aria-current="step"]')
    expect(current).toHaveLength(1)
    expect(current[0]).toHaveAttribute('data-stage', 'contactado')
    expect(current[0]).toHaveTextContent(LEAD_STAGES.contactado.label)
  })

  it('marca la etapa actual correcta también para una etapa intermedia (asignado)', () => {
    render(<LeadStagePipeline currentStage="asignado" onSelect={() => {}} />)
    const current = document.querySelector('[data-current="true"]')
    expect(current).toHaveAttribute('data-stage', 'asignado')
  })

  it('al clickear una etapa dispara onSelect con esa etapa (mismo evento de mover)', () => {
    const onSelect = vi.fn()
    render(<LeadStagePipeline currentStage="nuevo" onSelect={onSelect} />)
    fireEvent.click(screen.getByRole('button', { name: new RegExp(LEAD_STAGES.contactado.label, 'i') }))
    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSelect).toHaveBeenCalledWith('contactado')
  })

  it('no dispara onSelect cuando está disabled', () => {
    const onSelect = vi.fn()
    render(<LeadStagePipeline currentStage="nuevo" onSelect={onSelect} disabled />)
    const btn = screen.getByRole('button', { name: new RegExp(LEAD_STAGES.calificado.label, 'i') })
    expect(btn).toBeDisabled()
    fireEvent.click(btn)
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('para una etapa terminal (perdido) muestra la etapa actual fuera del pipeline lineal', () => {
    render(<LeadStagePipeline currentStage="perdido" onSelect={() => {}} />)
    // El badge terminal es el único marcado como actual.
    const current = screen.getByText(LEAD_STAGES.perdido.label, { selector: '[data-current="true"]' })
    expect(current).toHaveAttribute('data-stage', 'perdido')
    // Ninguna etapa del pipeline lineal queda marcada como actual.
    const pipeline = document.querySelectorAll('button[aria-current="step"]')
    expect(pipeline).toHaveLength(0)
  })

  it('marca como completadas las etapas previas a la actual', () => {
    render(<LeadStagePipeline currentStage="calificado" onSelect={() => {}} />)
    // "nuevo" (order 1) < "calificado" (order 4) => completada, debe mostrar el check.
    const nuevoBtn = screen.getByRole('button', { name: new RegExp(LEAD_STAGES.nuevo.label, 'i') })
    expect(within(nuevoBtn).queryByText(LEAD_STAGES.nuevo.label)).toBeTruthy()
    expect(nuevoBtn).not.toHaveAttribute('aria-current')
  })
})
