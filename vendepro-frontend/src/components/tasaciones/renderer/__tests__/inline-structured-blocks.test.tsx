import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent, screen } from '@testing-library/react'
import { CoverBlock } from '../blocks/CoverBlock'
import { MethodologyBlock } from '../blocks/MethodologyBlock'
import { CtaWhatsappBlock } from '../blocks/CtaWhatsappBlock'
import { AgentContactCardBlock } from '../blocks/AgentContactCardBlock'
import type { AppraisalContext } from '../types'

const appraisal: AppraisalContext = {
  id: 'a1', property_address: 'Calle 123', neighborhood: null, city: null, property_type: null,
  covered_area: null, total_area: null, semi_area: null, weighted_area: null,
  swot: null, prices: null, comparables: [], agent: null, org: null,
}

describe('CoverBlock — edición inline', () => {
  it('sin edit, el título se muestra como texto plano', () => {
    render(<CoverBlock data={{ title: 'Hola' }} appraisal={appraisal} />)
    expect(screen.getByText('Hola').getAttribute('contenteditable')).toBeNull()
  })

  it('con edit, el título es contenteditable y commitea via onCommit', () => {
    const onChange = vi.fn()
    render(<CoverBlock data={{ title: 'Hola' }} appraisal={appraisal} edit={{ onChange }} />)
    const titleEl = screen.getByText('Hola')
    expect(titleEl.getAttribute('contenteditable')).toBe('true')
    titleEl.textContent = 'Chau'
    fireEvent.blur(titleEl)
    expect(onChange).toHaveBeenCalledWith({ title: 'Chau' })
  })
})

describe('MethodologyBlock — edición inline', () => {
  it('con edit, el body es contenteditable y commitea via onCommit', () => {
    const onChange = vi.fn()
    render(<MethodologyBlock data={{ title: 'M', body: 'Cuerpo' }} edit={{ onChange }} />)
    const bodyEl = screen.getByText('Cuerpo')
    bodyEl.textContent = 'Nuevo cuerpo'
    fireEvent.blur(bodyEl)
    expect(onChange).toHaveBeenCalledWith({ body: 'Nuevo cuerpo' })
  })
})

describe('CtaWhatsappBlock — edición inline', () => {
  it('con edit, muestra los campos aunque no haya teléfono cargado, y commitea el texto', () => {
    const onChange = vi.fn()
    render(<CtaWhatsappBlock data={{ text: 'Hola' }} edit={{ onChange }} />)
    expect(screen.getByPlaceholderText('5491158574005')).toBeInTheDocument()
    const textEl = screen.getByText('Hola')
    textEl.textContent = 'Escribinos'
    fireEvent.blur(textEl)
    expect(onChange).toHaveBeenCalledWith({ text: 'Escribinos' })
  })

  it('sin edit y sin teléfono, no renderiza nada', () => {
    const { container } = render(<CtaWhatsappBlock data={{}} />)
    expect(container.firstChild).toBeNull()
  })
})

describe('AgentContactCardBlock — edición inline', () => {
  it('con edit, el nombre es contenteditable y commitea', () => {
    const onChange = vi.fn()
    render(<AgentContactCardBlock data={{ name: 'Marcela' }} appraisal={appraisal} edit={{ onChange }} />)
    const nameEl = screen.getByText('Marcela')
    nameEl.textContent = 'Marcela G.'
    fireEvent.blur(nameEl)
    expect(onChange).toHaveBeenCalledWith({ name: 'Marcela G.' })
  })
})
