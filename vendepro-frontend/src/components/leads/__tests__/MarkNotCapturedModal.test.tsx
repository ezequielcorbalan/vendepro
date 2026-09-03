import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MarkNotCapturedModal } from '../MarkNotCapturedModal'

/** yyyy-mm-dd de hoy + N días, con la misma aritmética local que el componente. */
function isoIn(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

const noop = () => {}

describe('MarkNotCapturedModal', () => {
  beforeEach(() => {
    // Fecha fija: si no, un test que corre a las 23:59:59 compara contra otro día.
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-03T15:00:00'))
  })
  afterEach(() => vi.useRealTimers())

  it('por defecto propone recontactar en 1 mes', () => {
    const onConfirm = vi.fn()
    render(<MarkNotCapturedModal open leadName="Ana Pérez" onClose={noop} onConfirm={onConfirm} />)
    fireEvent.click(screen.getByRole('button', { name: 'Marcar no captado' }))
    expect(onConfirm).toHaveBeenCalledWith({ reason: '', recontactDate: isoIn(30) })
  })

  it('devuelve el motivo tipeado junto con la fecha', () => {
    const onConfirm = vi.fn()
    render(<MarkNotCapturedModal open leadName="Ana Pérez" onClose={noop} onConfirm={onConfirm} />)
    fireEvent.change(screen.getByPlaceholderText('Motivo (opcional)'), {
      target: { value: 'eligió otra inmobiliaria' },
    })
    fireEvent.click(screen.getByRole('radio', { name: 'En 4 meses' }))
    fireEvent.click(screen.getByRole('button', { name: 'Marcar no captado' }))
    expect(onConfirm).toHaveBeenCalledWith({
      reason: 'eligió otra inmobiliaria',
      recontactDate: isoIn(120),
    })
  })

  it('con "No recontactar" no devuelve fecha', () => {
    const onConfirm = vi.fn()
    render(<MarkNotCapturedModal open onClose={noop} onConfirm={onConfirm} />)
    fireEvent.click(screen.getByRole('radio', { name: 'No recontactar' }))
    fireEvent.click(screen.getByRole('button', { name: 'Marcar no captado' }))
    expect(onConfirm).toHaveBeenCalledWith({ reason: '', recontactDate: null })
  })

  it('con "Otra fecha" bloquea la confirmación hasta elegir una', () => {
    const onConfirm = vi.fn()
    render(<MarkNotCapturedModal open onClose={noop} onConfirm={onConfirm} />)
    fireEvent.click(screen.getByRole('radio', { name: 'Otra fecha' }))
    const confirm = screen.getByRole('button', { name: 'Marcar no captado' })
    expect(confirm).toBeDisabled()

    fireEvent.change(screen.getByLabelText(/Fecha de recontacto/), { target: { value: '2027-01-15' } })
    fireEvent.click(screen.getByRole('button', { name: 'Marcar no captado' }))
    expect(onConfirm).toHaveBeenCalledWith({ reason: '', recontactDate: '2027-01-15' })
  })

  it('cancelar no confirma', () => {
    const onConfirm = vi.fn()
    const onClose = vi.fn()
    render(<MarkNotCapturedModal open onClose={onClose} onConfirm={onConfirm} />)
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('cerrado no renderiza nada', () => {
    render(<MarkNotCapturedModal open={false} onClose={noop} onConfirm={noop} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
