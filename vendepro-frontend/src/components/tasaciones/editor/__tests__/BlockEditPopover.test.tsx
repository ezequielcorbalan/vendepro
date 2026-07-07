import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { BlockEditPopover } from '../BlockEditPopover'
import type { TemplateBlock } from '../../renderer/types'

describe('BlockEditPopover', () => {
  it('renderiza el BlockForm del tipo de bloque y el título del bloque', () => {
    const block: TemplateBlock = { id: 'b1', type: 'services_grid', binding_mode: 'system', include_in_pdf: true, sort_order: 0, data: { services: [] } }
    render(<BlockEditPopover block={block} override={{}} onPatch={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByText('Nuestros servicios')).toBeInTheDocument()
    expect(screen.getByText('+ Agregar')).toBeInTheDocument()
  })

  it('llama a onClose al hacer click en el botón de cerrar', () => {
    const block: TemplateBlock = { id: 'b1', type: 'swot', binding_mode: 'tasacion', include_in_pdf: true, sort_order: 0, data: {} }
    const onClose = vi.fn()
    render(<BlockEditPopover block={block} override={{}} onPatch={vi.fn()} onClose={onClose} />)
    fireEvent.click(screen.getByLabelText('Cerrar edición'))
    expect(onClose).toHaveBeenCalled()
  })
})
