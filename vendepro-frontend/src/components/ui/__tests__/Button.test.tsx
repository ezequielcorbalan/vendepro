import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Button } from '../Button'

describe('Button', () => {
  it('por default es type="button" (no submitea en forms) — regresión auditoría #1', () => {
    render(<Button>Guardar</Button>)
    expect(screen.getByRole('button', { name: 'Guardar' })).toHaveAttribute('type', 'button')
  })

  it('permite type="submit" explícito', () => {
    render(<Button type="submit">Enviar</Button>)
    expect(screen.getByRole('button', { name: 'Enviar' })).toHaveAttribute('type', 'submit')
  })

  it('loading deshabilita el botón', () => {
    const onClick = vi.fn()
    render(<Button loading onClick={onClick}>X</Button>)
    const btn = screen.getByRole('button')
    expect(btn).toBeDisabled()
    fireEvent.click(btn)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('aplica la variante primary (color primario) por default', () => {
    render(<Button>X</Button>)
    expect(screen.getByRole('button').className).toContain('bg-primary')
  })

  it('variant="outline" es gris (secundario)', () => {
    render(<Button variant="outline">X</Button>)
    const cls = screen.getByRole('button').className
    expect(cls).toContain('border-gray-300')
    expect(cls).toContain('text-gray-700')
  })
})
