import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { Switch } from '../Switch'
import { Checkbox } from '../Choice'
import { PillCheckGroup, PillRadioGroup } from '../ChoicePills'

afterEach(cleanup)

/**
 * Los tres controles tomaban su nombre accesible del prop `label`, que ADEMÁS se
 * dibuja. Donde la etiqueta ya estaba en la pantalla —un título a la izquierda,
 * una celda— pasarlo la duplicaba, y no pasarlo dejaba el control sin nombre. Eso
 * es lo que pasó en el toggle de webhooks, en el del wizard de tasación y en la
 * fila de agentes de objetivos: los tres quedaron mudos para un lector de
 * pantalla, sin que nada lo avisara.
 */
describe('Switch', () => {
  it('el label visible también lo nombra', () => {
    render(<Switch checked onChange={() => {}} label="Activo" />)
    expect(screen.getByRole('switch', { name: 'Activo' })).toBeInTheDocument()
  })

  it('aria-label lo nombra sin dibujar texto', () => {
    const { container } = render(
      <Switch checked onChange={() => {}} aria-label="Ocultar bloques fijos" />,
    )
    expect(screen.getByRole('switch', { name: 'Ocultar bloques fijos' })).toBeInTheDocument()
    expect(container.textContent).toBe('')
  })

  it('aria-label le gana al label cuando están los dos', () => {
    render(<Switch checked onChange={() => {}} label="Sí" aria-label="Recibir avisos" />)
    expect(screen.getByRole('switch', { name: 'Recibir avisos' })).toBeInTheDocument()
  })
})

describe('Checkbox', () => {
  it('aria-label lo nombra sin dibujar texto', () => {
    const { container } = render(
      <Checkbox checked={false} onChange={() => {}} aria-label="Incluir bloque FODA" />,
    )
    expect(screen.getByRole('checkbox', { name: 'Incluir bloque FODA' })).toBeInTheDocument()
    expect(container.textContent).toBe('')
  })
})

describe('ChoicePills', () => {
  const opciones = [{ value: 'a', label: 'Admin' }]

  it('el grupo múltiple se nombra sin dibujar el label', () => {
    render(<PillCheckGroup aria-label="Agentes" options={opciones} value={[]} onChange={() => {}} />)
    expect(screen.getByRole('group', { name: 'Agentes' })).toBeInTheDocument()
    expect(screen.queryByText('Agentes')).toBeNull()
  })

  it('el grupo único también', () => {
    render(<PillRadioGroup aria-label="Pipeline" options={opciones} value="a" onChange={() => {}} />)
    expect(screen.getByRole('radiogroup', { name: 'Pipeline' })).toBeInTheDocument()
    expect(screen.queryByText('Pipeline')).toBeNull()
  })
})
