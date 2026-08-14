import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { Modal } from '../Modal'

afterEach(cleanup)

describe('Modal', () => {
  it('no renderiza nada cuando open=false', () => {
    render(<Modal open={false} onClose={() => {}} title="T">contenido</Modal>)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('abierto: expone role="dialog" con aria-modal y bloquea el scroll del body — regresión #6', () => {
    render(<Modal open onClose={() => {}} title="Publicar">cuerpo</Modal>)
    const dialog = screen.getByRole('dialog', { name: 'Publicar' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(screen.getByText('cuerpo')).toBeInTheDocument()
    expect(document.body.style.overflow).toBe('hidden')
  })

  it('cierra con Escape', () => {
    const onClose = vi.fn()
    render(<Modal open onClose={onClose} title="T">x</Modal>)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })
})
