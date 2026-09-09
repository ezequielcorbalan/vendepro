import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { overlayContract } from './overlay-contract'
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

  it('el motivo se puede tipear sin que el foco se escape', () => {
    // Es el único campo del diálogo, y el bug de `useOverlay` (onClose en las
    // deps) se manifestaba justo así: una tecla y el foco saltaba al botón.
    const onConfirm = vi.fn()
    render(
      <ConfirmDialog
        title="T" message="M" requireReason reasonPlaceholder="Motivo"
        onConfirm={onConfirm} onCancel={() => {}}
      />,
    )
    const ta = screen.getByLabelText('Motivo')
    ta.focus()
    fireEvent.change(ta, { target: { value: 'porque sí' } })
    expect(document.activeElement).toBe(ta)
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }))
    expect(onConfirm).toHaveBeenCalledWith('porque sí')
  })
})

/**
 * El contrato completo. Hasta el 04/09/2026 este componente armaba su overlay a
 * mano y no cumplía ni uno de los seis chequeos: sin Portal, sin scroll-lock,
 * sin focus-trap y sin devolución de foco. Y es el que el DS manda usar antes de
 * borrar algo.
 */
describe('ConfirmDialog · contrato de overlay', () => {
  const contrato = overlayContract(onClose => (
    <ConfirmDialog title="Borrar lead" message="No se puede deshacer" onConfirm={() => {}} onCancel={onClose} />
  ))

  it('cierra con Escape', contrato.cierraConEsc)
  it('bloquea y restaura el scroll del body', contrato.bloqueaYRestauraElScroll)
  it('mueve el foco adentro del panel al abrir', contrato.mueveElFocoAdentro)
  it('devuelve el foco al disparador al cerrar', contrato.devuelveElFoco)
  it('se monta en un Portal, no en el árbol local', contrato.seMontaEnPortal)
  it('es un diálogo modal accesible', contrato.esDialogoModal)
})
