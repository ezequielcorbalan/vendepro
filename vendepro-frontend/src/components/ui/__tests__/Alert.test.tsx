import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Alert } from '../Alert'

describe('Alert', () => {
  it('tone="danger" usa role="alert" — regresión auditoría #9', () => {
    render(<Alert tone="danger">Falló</Alert>)
    expect(screen.getByRole('alert')).toHaveTextContent('Falló')
  })

  it('otros tonos usan role="status"', () => {
    render(<Alert tone="info">Info</Alert>)
    expect(screen.getByRole('status')).toHaveTextContent('Info')
  })

  it('el texto va en color principal (ink), no en el color del alerta', () => {
    render(<Alert tone="danger" title="Error">detalle</Alert>)
    expect(screen.getByRole('alert').className).toContain('text-ink')
  })
})
