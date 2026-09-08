import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StepCard } from '../StepCard'

describe('StepCard', () => {
  it('el título es el encabezado, y el número no se lee', () => {
    render(<StepCard step={2} title="Hacé el request">contenido</StepCard>)
    // El encabezado accesible es el título. Si el número entrara en el nombre,
    // un lector de pantalla diría "2 Hacé el request", que no es lo que dice
    // la pantalla.
    expect(screen.getByRole('heading', { name: 'Hacé el request' })).toBeInTheDocument()
    const numero = screen.getByText('2')
    expect(numero).toHaveAttribute('aria-hidden')
  })

  it('el nivel del encabezado se elige, para no saltearse uno', () => {
    // En automatizaciones los pasos son la primera jerarquía (h3). En la prueba
    // de token cuelgan de un título de sección, así que van h4: saltar de h3 a
    // h5 —o repetir h3— rompe la navegación por encabezados.
    const { unmount } = render(<StepCard step={1} title="Por defecto">x</StepCard>)
    expect(screen.getByRole('heading', { name: 'Por defecto' }).tagName).toBe('H3')
    unmount()
    render(<StepCard step={1} level={4} title="Bajo una sección">x</StepCard>)
    expect(screen.getByRole('heading', { name: 'Bajo una sección' }).tagName).toBe('H4')
  })

  it('el número va en gris, no en primary', () => {
    // `primary` está reservado para acciones y estados (regla 15). Un ordinal no
    // es ninguna de las dos: la versión de /configuracion/api lo tenía rosa y
    // la de automatizaciones gris, y esa discrepancia es la que se unificó.
    render(<StepCard step={3} title="T">x</StepCard>)
    const numero = screen.getByText('3')
    expect(numero.className).toContain('bg-gray-100')
    expect(numero.className).not.toContain('bg-primary')
  })

  it('el subtítulo acepta nodos, no sólo texto', () => {
    render(
      <StepCard step={1} title="T" subtitle={<>Acepta <code>JSON</code> acá</>}>x</StepCard>,
    )
    expect(screen.getByText('JSON').tagName).toBe('CODE')
  })

  it('la acción va al lado del título, no adentro del contenido', () => {
    render(
      <StepCard step={1} title="Título" action={<button>Copiar</button>}>
        <p>cuerpo</p>
      </StepCard>,
    )
    const boton = screen.getByRole('button', { name: 'Copiar' })
    const cuerpo = screen.getByText('cuerpo')
    expect(boton.contains(cuerpo)).toBe(false)
    // La acción precede al cuerpo en el DOM: es del encabezado del paso.
    expect(boton.compareDocumentPosition(cuerpo) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})
