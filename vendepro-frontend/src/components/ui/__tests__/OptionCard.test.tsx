import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { OptionCard } from '../OptionCard'
import { WhatsAppButton } from '../ContactButtons'

describe('OptionCard', () => {
  it('expone el estado seleccionado con aria-pressed', () => {
    const { rerender } = render(<OptionCard title="Método probado" />)
    expect(screen.getByRole('button', { name: /Método probado/ })).toHaveAttribute('aria-pressed', 'false')
    rerender(<OptionCard title="Método probado" selected />)
    expect(screen.getByRole('button', { name: /Método probado/ })).toHaveAttribute('aria-pressed', 'true')
  })

  it('muestra la descripción y dispara onClick', () => {
    const onClick = vi.fn()
    render(<OptionCard title="Personalizado" description="Métrica a métrica" onClick={onClick} />)
    expect(screen.getByText('Métrica a métrica')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Personalizado/ }))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('es type=button, no dispara submit dentro de un form', () => {
    render(<OptionCard title="Opción" />)
    expect(screen.getByRole('button', { name: 'Opción' })).toHaveAttribute('type', 'button')
  })
})

describe('WhatsAppButton — modo compartir', () => {
  it('sin phone y sin share queda deshabilitado', () => {
    render(<WhatsAppButton />)
    expect(screen.getByRole('button', { name: 'WhatsApp' })).toBeDisabled()
  })

  it('share arma wa.me sin destinatario y con el texto', () => {
    render(<WhatsAppButton share message="hola mundo" />)
    const link = screen.getByRole('link', { name: 'WhatsApp' })
    expect(link).toHaveAttribute('href', 'https://wa.me/?text=hola%20mundo')
  })

  it('con phone sigue armando el link al número', () => {
    render(<WhatsAppButton phone="11 2345-6789" />)
    expect(screen.getByRole('link', { name: 'WhatsApp' }).getAttribute('href')).toContain('wa.me/')
  })

  it('label reemplaza el texto visible', () => {
    render(<WhatsAppButton share label="Abrir WhatsApp" />)
    expect(screen.getByText('Abrir WhatsApp')).toBeInTheDocument()
  })
})
