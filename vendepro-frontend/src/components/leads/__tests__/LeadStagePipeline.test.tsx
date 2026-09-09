import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { LeadStagePipeline } from '../LeadStagePipeline'
import { LEAD_STAGES, LEAD_PIPELINE_STAGES } from '@/lib/crm-config'

/**
 * Match exacto del nombre accesible. Anclado y no substring porque hay labels
 * que son prefijo de otro: "Captado" contra "No captado" (la etapa `perdido`
 * del pipeline vendedor), y un `/captado/i` los agarraría a los dos.
 */
const exactLabel = (label: string) => new RegExp(`^${label}$`, 'i')

describe('LeadStagePipeline', () => {
  it('renderiza todas las etapas del pipeline', () => {
    render(<LeadStagePipeline currentStage="nuevo" onSelect={() => {}} />)
    for (const s of LEAD_PIPELINE_STAGES) {
      expect(screen.getByRole('button', { name: exactLabel(LEAD_STAGES[s].label) })).toBeInTheDocument()
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
    fireEvent.click(screen.getByRole('button', { name: exactLabel(LEAD_STAGES.contactado.label) }))
    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSelect).toHaveBeenCalledWith('contactado')
  })

  it('no dispara onSelect cuando está disabled', () => {
    const onSelect = vi.fn()
    render(<LeadStagePipeline currentStage="nuevo" onSelect={onSelect} disabled />)
    const btn = screen.getByRole('button', { name: exactLabel(LEAD_STAGES.calificado.label) })
    expect(btn).toBeDisabled()
    fireEvent.click(btn)
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('expone los estados terminales (perdido/invalido) como botones clickeables', () => {
    const onSelect = vi.fn()
    render(<LeadStagePipeline currentStage="contactado" onSelect={onSelect} />)
    const perdido = screen.getByRole('button', { name: exactLabel(LEAD_STAGES.perdido.label) })
    const invalido = screen.getByRole('button', { name: exactLabel(LEAD_STAGES.invalido.label) })
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
    fireEvent.click(screen.getByRole('button', { name: exactLabel(LEAD_STAGES.seguimiento.label) }))
    expect(onSelect).toHaveBeenCalledWith('seguimiento')
  })

  it('deshabilita las etapas a las que no se puede avanzar (salteadas)', () => {
    render(<LeadStagePipeline currentStage="nuevo" onSelect={() => {}} />)
    // nuevo → contactado es válido (siguiente) → habilitado
    expect(screen.getByRole('button', { name: exactLabel(LEAD_STAGES.contactado.label) })).toBeEnabled()
    // nuevo → en_tasacion saltea etapas → deshabilitado
    expect(screen.getByRole('button', { name: exactLabel(LEAD_STAGES.en_tasacion.label) })).toBeDisabled()
    expect(screen.getByRole('button', { name: exactLabel(LEAD_STAGES.captado.label) })).toBeDisabled()
  })

  it('habilita todas las etapas anteriores (corrección hacia atrás)', () => {
    render(<LeadStagePipeline currentStage="presentada" onSelect={() => {}} />)
    // todas las anteriores habilitadas (bypass)
    for (const s of ['nuevo', 'asignado', 'contactado', 'calificado', 'en_tasacion'] as const) {
      expect(screen.getByRole('button', { name: exactLabel(LEAD_STAGES[s].label) })).toBeEnabled()
    }
  })

  it('marca como completadas las etapas previas a la actual', () => {
    render(<LeadStagePipeline currentStage="calificado" onSelect={() => {}} />)
    // "nuevo" (order 1) < "calificado" (order 4) => completada, debe mostrar el check.
    const nuevoBtn = screen.getByRole('button', { name: exactLabel(LEAD_STAGES.nuevo.label) })
    expect(within(nuevoBtn).queryByText(LEAD_STAGES.nuevo.label)).toBeTruthy()
    expect(nuevoBtn).not.toHaveAttribute('aria-current')
  })
})
