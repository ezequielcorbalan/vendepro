import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent, screen } from '@testing-library/react'
import { EditableCanvas } from '../EditableCanvas'
import type { AppraisalContext, TemplateBlock } from '../../renderer/types'

const appraisal: AppraisalContext = {
  id: 'a1', property_address: 'X', neighborhood: null, city: null, property_type: null,
  covered_area: null, total_area: null, semi_area: null, weighted_area: null,
  swot: null, prices: null, comparables: [], agent: null, org: null,
}

function noop() {}

describe('EditableCanvas — color de fondo', () => {
  it('un bloque libre (heading) persiste el fondo vía onPatchData', () => {
    const snapshot: TemplateBlock[] = [{ id: 'b1', type: 'heading', binding_mode: 'tasacion', include_in_pdf: true, sort_order: 0, data: { text: 'Hola' } }]
    const onPatchData = vi.fn()
    const onPatchOverride = vi.fn()
    render(
      <EditableCanvas
        snapshot={snapshot} overrides={{}} appraisal={appraisal} mode="web"
        onAdd={noop} onRemove={noop} onReorder={noop}
        onPatchData={onPatchData} onPatchOverride={onPatchOverride}
      />
    )
    fireEvent.click(screen.getByTitle('Color de fondo'))
    fireEvent.change(screen.getByLabelText('Elegir color de fondo'), { target: { value: '#112233' } })
    expect(onPatchData).toHaveBeenCalledWith('b1', { background_color: '#112233' })
    expect(onPatchOverride).not.toHaveBeenCalled()
  })

  it('un bloque estructurado (methodology) persiste el fondo vía onPatchOverride', () => {
    const snapshot: TemplateBlock[] = [{ id: 'b2', type: 'methodology', binding_mode: 'system', include_in_pdf: true, sort_order: 0, data: { title: 'M' } }]
    const onPatchData = vi.fn()
    const onPatchOverride = vi.fn()
    render(
      <EditableCanvas
        snapshot={snapshot} overrides={{}} appraisal={appraisal} mode="web"
        onAdd={noop} onRemove={noop} onReorder={noop}
        onPatchData={onPatchData} onPatchOverride={onPatchOverride}
      />
    )
    fireEvent.click(screen.getByTitle('Color de fondo'))
    fireEvent.change(screen.getByLabelText('Elegir color de fondo'), { target: { value: '#445566' } })
    expect(onPatchOverride).toHaveBeenCalledWith('b2', { background_color: '#445566' })
    expect(onPatchData).not.toHaveBeenCalled()
  })
})

describe('EditableCanvas — bloques estructurados inline', () => {
  it('methodology (binding_mode system) edita el título inline y persiste vía onPatchOverride', () => {
    const snapshot: TemplateBlock[] = [{ id: 'b1', type: 'methodology', binding_mode: 'system', include_in_pdf: true, sort_order: 0, data: { title: 'Original' } }]
    const onPatchOverride = vi.fn()
    render(
      <EditableCanvas
        snapshot={snapshot} overrides={{}} appraisal={appraisal} mode="web"
        onAdd={noop} onRemove={noop} onReorder={noop}
        onPatchData={vi.fn()} onPatchOverride={onPatchOverride}
      />
    )
    const titleEl = screen.getByText('Original')
    titleEl.textContent = 'Editado'
    fireEvent.blur(titleEl)
    expect(onPatchOverride).toHaveBeenCalledWith('b1', { title: 'Editado' })
  })
})
