import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Field, Input } from '../Input'

describe('Field + Input', () => {
  it('asocia el label al control vía id autogenerado — regresión auditoría #3', () => {
    render(
      <Field label="Nombre">
        <Input placeholder="tu nombre" />
      </Field>,
    )
    // getByLabelText sólo encuentra el input si el label quedó asociado por id
    const input = screen.getByLabelText('Nombre')
    expect(input).toBeInTheDocument()
    expect(input.id).toBeTruthy()
  })

  it('aplica el borde de error al control automáticamente cuando hay error', () => {
    render(
      <Field label="Email" error="Inválido">
        <Input />
      </Field>,
    )
    expect(screen.getByLabelText('Email').className).toContain('border-danger')
    expect(screen.getByText('Inválido')).toBeInTheDocument()
  })

  it('sin error, muestra el hint y no pinta borde de error', () => {
    render(
      <Field label="Tel" hint="Opcional">
        <Input />
      </Field>,
    )
    expect(screen.getByText('Opcional')).toBeInTheDocument()
    expect(screen.getByLabelText('Tel').className).not.toContain('border-danger')
  })
})
