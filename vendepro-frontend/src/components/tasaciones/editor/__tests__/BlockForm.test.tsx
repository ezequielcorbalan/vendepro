import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BlockForm } from '../BlockForm'
import type { TemplateBlock } from '../../renderer/types'

function block(binding_mode: TemplateBlock['binding_mode']): TemplateBlock {
  return { id: 'b1', type: 'methodology', binding_mode, include_in_pdf: true, sort_order: 0, data: { title: 'T' } }
}

describe('BlockForm — edición de bloques bloqueados', () => {
  it('en context=appraisal, renderiza el form real incluso si el binding_mode es system', () => {
    render(<BlockForm block={block('system')} override={{}} onPatch={vi.fn()} context="appraisal" />)
    expect(screen.getByText(/título/i)).toBeInTheDocument()
    expect(screen.queryByText(/se configura desde configuración/i)).not.toBeInTheDocument()
  })

  it('en context=appraisal con binding_mode bloqueado, muestra el aviso de override', () => {
    render(<BlockForm block={block('org-static')} override={{}} onPatch={vi.fn()} context="appraisal" />)
    expect(screen.getByText(/solo aplican a esta tasación/i)).toBeInTheDocument()
  })

  it('en context=appraisal con binding_mode tasacion, NO muestra el aviso de override', () => {
    render(<BlockForm block={block('tasacion')} override={{}} onPatch={vi.fn()} context="appraisal" />)
    expect(screen.queryByText(/solo aplican a esta tasación/i)).not.toBeInTheDocument()
  })

  it('en context=template con binding_mode bloqueado, se mantiene el bloqueo original', () => {
    render(<BlockForm block={block('system')} override={{}} onPatch={vi.fn()} context="template" />)
    expect(screen.getByText(/se configura desde configuración/i)).toBeInTheDocument()
  })
})
