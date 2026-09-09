import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import HowItWorks from '../HowItWorks'

afterEach(cleanup)

describe('Cómo funciona', () => {
  it('arranca colapsado: es para consultar, no para leer todos los días', () => {
    render(<HowItWorks pipeline="vendedor" />)
    expect(screen.getByText('Cómo funciona')).toBeInTheDocument()
    expect(screen.queryByText('¿Qué período estoy mirando?')).not.toBeInTheDocument()
    expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'false')
  })

  it('se abre y cierra', () => {
    render(<HowItWorks pipeline="vendedor" />)
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByText('¿Qué período estoy mirando?')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button'))
    expect(screen.queryByText('¿Qué período estoy mirando?')).not.toBeInTheDocument()
  })

  // Las dos mitades se calculan distinto, así que explicarlas juntas confundiría
  // más de lo que aclara.
  it('en Captación explica el CPL y la atribución por nombre de campaña', () => {
    render(<HowItWorks pipeline="vendedor" />)
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByText('¿Por qué hay dos columnas de CPL?')).toBeInTheDocument()
    expect(screen.getByText('¿Cómo se sabe qué lead trajo cada campaña?')).toBeInTheDocument()
    expect(screen.queryByText(/prorratea/)).not.toBeInTheDocument()
  })

  it('en Demanda explica el prorrateo y el dólar congelado', () => {
    render(<HowItWorks pipeline="comprador" />)
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByText('¿Por qué el gasto no coincide con la factura del portal?')).toBeInTheDocument()
    expect(screen.getByText('¿Con qué dólar se convierte?')).toBeInTheDocument()
    expect(screen.queryByText(/dos columnas de CPL/)).not.toBeInTheDocument()
  })

  it('lo común a las dos secciones aparece en ambas', () => {
    render(<HowItWorks pipeline="comprador" />)
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByText('¿Qué período estoy mirando?')).toBeInTheDocument()
    expect(screen.getByText('¿Por qué hay dos secciones?')).toBeInTheDocument()
  })
})
