import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Table, type Column } from '../Table'

interface Row { id: string; barrio: string; vistas: number }

const data: Row[] = [
  { id: 'a', barrio: 'Palermo', vistas: 12 },
  { id: 'b', barrio: 'Belgrano', vistas: 41 },
]

const columns: Column<Row>[] = [
  { key: 'barrio', header: 'Barrio' },
  { key: 'vistas', header: 'Vistas', align: 'right' },
]

describe('Table', () => {
  it('sin expandedContent no agrega la columna del chevron', () => {
    render(<Table columns={columns} data={data} rowKey={r => r.id} />)
    expect(screen.getAllByRole('columnheader')).toHaveLength(2)
    expect(screen.queryByRole('button', { name: 'Ver detalle' })).not.toBeInTheDocument()
  })

  it('expandedContent despliega el detalle de la fila y lo vuelve a ocultar', () => {
    render(
      <Table
        columns={columns}
        data={data}
        rowKey={r => r.id}
        expandedContent={r => <p>detalle de {r.barrio}</p>}
      />,
    )
    expect(screen.queryByText('detalle de Palermo')).not.toBeInTheDocument()

    const toggles = screen.getAllByRole('button', { name: 'Ver detalle' })
    fireEvent.click(toggles[0])
    expect(screen.getByText('detalle de Palermo')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Ocultar detalle' }))
    expect(screen.queryByText('detalle de Palermo')).not.toBeInTheDocument()
  })

  it('sólo una fila queda expandida a la vez', () => {
    render(
      <Table
        columns={columns}
        data={data}
        rowKey={r => r.id}
        expandedContent={r => <p>detalle de {r.barrio}</p>}
      />,
    )
    const toggles = screen.getAllByRole('button', { name: 'Ver detalle' })
    fireEvent.click(toggles[0])
    fireEvent.click(screen.getAllByRole('button', { name: 'Ver detalle' })[0])
    expect(screen.queryByText('detalle de Palermo')).not.toBeInTheDocument()
    expect(screen.getByText('detalle de Belgrano')).toBeInTheDocument()
  })

  it('expandedContent que devuelve null no hace expandible la fila', () => {
    render(
      <Table
        columns={columns}
        data={data}
        rowKey={r => r.id}
        expandedContent={r => (r.barrio === 'Palermo' ? <p>sólo Palermo</p> : null)}
      />,
    )
    expect(screen.getAllByRole('button', { name: 'Ver detalle' })).toHaveLength(1)
  })

  it('hideBelow oculta la columna por breakpoint, en header y celdas', () => {
    render(
      <Table
        columns={[{ key: 'barrio', header: 'Barrio' }, { key: 'vistas', header: 'Vistas', hideBelow: 'md' }]}
        data={data}
        rowKey={r => r.id}
      />,
    )
    expect(screen.getByRole('columnheader', { name: 'Vistas' }).className).toContain('hidden md:table-cell')
    expect(screen.getByText('41').className).toContain('hidden md:table-cell')
  })

  it('cada fila lleva `group`, para revelar acciones al hover', () => {
    render(<Table columns={columns} data={data} rowKey={r => r.id} />)
    const row = screen.getByText('Palermo').closest('tr')
    expect(row?.className).toContain('group')
  })
})
