import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import FaqBlock from '../FaqBlock'

describe('FaqBlock', () => {
  it('renderiza todas las preguntas y respuestas', () => {
    render(<FaqBlock data={{ title: 'Preguntas', items: [
      { question: '¿Cuánto tarda?', answer: 'Tres semanas.' },
      { question: '¿Qué gastos hay?', answer: 'Honorarios y sellos.' },
    ] }} />)
    expect(screen.getByText('Preguntas')).toBeInTheDocument()
    expect(screen.getByText('¿Cuánto tarda?')).toBeInTheDocument()
    expect(screen.getByText('Honorarios y sellos.')).toBeInTheDocument()
  })
})
