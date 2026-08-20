import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Stepper } from '../Stepper'

describe('Stepper', () => {
  it('variant dots se anuncia como progressbar con el paso actual', () => {
    render(<Stepper steps={8} current={2} label="Progreso del tutorial" />)
    const bar = screen.getByRole('progressbar', { name: 'Progreso del tutorial' })
    expect(bar).toHaveAttribute('aria-valuenow', '3')
    expect(bar).toHaveAttribute('aria-valuemax', '8')
    expect(bar).toHaveAttribute('aria-valuetext', 'Paso 3 de 8')
  })

  it('showCount muestra el contador 1-based', () => {
    render(<Stepper steps={5} current={0} showCount />)
    expect(screen.getByText('1/5')).toBeInTheDocument()
  })

  it('variant pills marca el paso actual con aria-current y navega al click', () => {
    const onStepChange = vi.fn()
    render(
      <Stepper
        variant="pills"
        current={1}
        onStepChange={onStepChange}
        steps={[{ label: 'Terreno' }, { label: 'Costos' }, { label: 'Resultado' }]}
      />,
    )
    expect(screen.getByRole('button', { name: 'Costos' })).toHaveAttribute('aria-current', 'step')
    expect(screen.getByRole('button', { name: 'Terreno' })).not.toHaveAttribute('aria-current')

    fireEvent.click(screen.getByRole('button', { name: 'Resultado' }))
    expect(onStepChange).toHaveBeenCalledWith(2)
  })

  it('los pasos de dots no son interactivos', () => {
    render(<Stepper steps={3} current={1} />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
