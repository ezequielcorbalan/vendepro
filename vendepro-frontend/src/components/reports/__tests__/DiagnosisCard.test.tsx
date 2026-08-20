import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import DiagnosisCard from '../DiagnosisCard'

const props = {
  neighborhood: 'Palermo',
  deltaPct: -32.4,
  activeViewsPerDay: 12,
  soldViewsPerDay: 41,
}

describe('DiagnosisCard', () => {
  it('se anuncia como alerta (Alert tone="danger" del DS)', () => {
    render(<DiagnosisCard {...props} />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('muestra el delta en positivo y ambos promedios', () => {
    render(<DiagnosisCard {...props} />)
    expect(screen.getByText('32% por debajo del benchmark')).toBeInTheDocument()
    expect(screen.getByText('12 vis/día')).toBeInTheDocument()
    expect(screen.getByText('41 vis/día')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('En Palermo')
  })

  it('lista los pasos de comercialización', () => {
    render(<DiagnosisCard {...props} />)
    for (const label of [
      'Precio de publicación',
      'Fotos profesionales',
      'Tour Virtual 360°',
      'Plano',
      'Video',
      'Redes sociales',
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
  })
})
