import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DataList, DataListRow } from '../DataList'

describe('DataList', () => {
  it('separa las filas con divisores', () => {
    const { container } = render(
      <DataList>
        <DataListRow title="Marcela Sosa" />
        <DataListRow title="Julián Ferreyra" />
      </DataList>,
    )
    expect(container.firstChild).toHaveClass('divide-y')
    expect(screen.getByText('Marcela Sosa')).toBeInTheDocument()
    expect(screen.getByText('Julián Ferreyra')).toBeInTheDocument()
  })

  it('renderiza media, badge, acción y metadata de la fila', () => {
    render(
      <DataList>
        <DataListRow
          media={<span data-testid="avatar">MS</span>}
          title="Marcela Sosa"
          badge={<span>Propietario</span>}
          action={<button type="button">Borrar</button>}
        >
          <p>Palermo</p>
        </DataListRow>
      </DataList>,
    )
    expect(screen.getByTestId('avatar')).toBeInTheDocument()
    expect(screen.getByText('Propietario')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Borrar' })).toBeInTheDocument()
    expect(screen.getByText('Palermo')).toBeInTheDocument()
  })

  it('los slots opcionales no dejan contenedores vacíos', () => {
    const { container } = render(
      <DataList>
        <DataListRow title="Sin extras" />
      </DataList>,
    )
    const vacios = [...container.querySelectorAll('div')].filter(d => d.innerHTML === '')
    expect(vacios).toHaveLength(0)
  })
})
