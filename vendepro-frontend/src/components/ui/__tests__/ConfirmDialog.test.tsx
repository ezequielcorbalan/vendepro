import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ConfirmDialog } from '../ConfirmDialog'

describe('ConfirmDialog', () => {
  it('muestra título y mensaje, y confirma con reason vacío por defecto', () => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    render(<ConfirmDialog title="Eliminar lead" message="¿Seguro?" confirmLabel="Eliminar" onConfirm={onConfirm} onCancel={onCancel} />)
    expect(screen.getByText('Eliminar lead')).toBeInTheDocument()
    expect(screen.getByText('¿Seguro?')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar' }))
    expect(onConfirm).toHaveBeenCalledWith('')
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('cancela con el botón Cancelar', () => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    render(<ConfirmDialog title="T" message="M" onConfirm={onConfirm} onCancel={onCancel} />)
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('con requireReason devuelve el texto ingresado', () => {
    const onConfirm = vi.fn()
    render(<ConfirmDialog title="Perdido" message="¿Motivo?" requireReason confirmLabel="Marcar" onConfirm={onConfirm} onCancel={() => {}} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'datos duplicados' } })
    fireEvent.click(screen.getByRole('button', { name: 'Marcar' }))
    expect(onConfirm).toHaveBeenCalledWith('datos duplicados')
  })

  it('cierra con Escape', () => {
    const onCancel = vi.fn()
    render(<ConfirmDialog title="T" message="M" onConfirm={() => {}} onCancel={onCancel} />)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})
