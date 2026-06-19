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

  it('expone los estados terminales (perdido/invalido) como botones clickeables', () => {
    const onSelect = vi.fn()
    render(<LeadStagePipeline currentStage="contactado" onSelect={onSelect} />)
    const perdido = screen.getByRole('button', { name: new RegExp(LEAD_STAGES.perdido.label, 'i') })
    const invalido = screen.getByRole('button', { name: new RegExp(LEAD_STAGES.invalido.label, 'i') })
    expect(perdido).toBeInTheDocument()
    expect(invalido).toBeInTheDocument()
    fireEvent.click(perdido)
    expect(onSelect).toHaveBeenCalledWith('perdido')
  })

  it('para una etapa terminal (perdido) marca su botón como actual', () => {
    render(<LeadStagePipeline currentStage="perdido" onSelect={() => {}} />)
    const current = document.querySelectorAll('[data-current="true"]')
    expect(current).toHaveLength(1)
    expect(current[0]).toHaveAttribute('data-stage', 'perdido')
    expect(current[0]?.tagName).toBe('BUTTON')
  })

  it('permite bypass hacia atrás: desde captado se puede clickear una etapa anterior', () => {
    const onSelect = vi.fn()
    render(<LeadStagePipeline currentStage="captado" onSelect={onSelect} />)
    fireEvent.click(screen.getByRole('button', { name: new RegExp(LEAD_STAGES.seguimiento.label, 'i') }))
    expect(onSelect).toHaveBeenCalledWith('seguimiento')
  })

  it('marca como completadas las etapas previas a la actual', () => {
    render(<LeadStagePipeline currentStage="calificado" onSelect={() => {}} />)
    // "nuevo" (order 1) < "calificado" (order 4) => completada, debe mostrar el check.
    const nuevoBtn = screen.getByRole('button', { name: new RegExp(LEAD_STAGES.nuevo.label, 'i') })
    expect(within(nuevoBtn).queryByText(LEAD_STAGES.nuevo.label)).toBeTruthy()
    expect(nuevoBtn).not.toHaveAttribute('aria-current')
  })
})
