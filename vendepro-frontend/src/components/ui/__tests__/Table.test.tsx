import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { Table, type Column } from '../Table'

const push = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))

afterEach(() => { cleanup(); push.mockClear() })

interface Row { id: string; nombre: string }
const DATA: Row[] = [
  { id: 'c1', nombre: 'Sorasol21' },
  { id: 'c2', nombre: 'Bruno Test' },
]
const COLS: Column<Row>[] = [{ key: 'nombre', header: 'Nombre' }]

describe('Table · rowHref', () => {
  /**
   * Regresión de producción: al agregar `actions` con hover-reveal, el chevron
   * de "Ver detalle" era la única señal de que la fila se podía abrir — y quedó
   * invisible hasta el hover. En una tabla de contactos eso se ve como "no puedo
   * entrar a un contacto". De ahí sale `rowHref`.
   */
  it('el chevron de "Ver detalle" está SIEMPRE visible, no escondido en hover', () => {
    render(<Table data={DATA} rowKey={r => r.id} columns={COLS} rowHref={r => `/contactos/${r.id}`} />)
    const ver = screen.getAllByLabelText('Ver detalle')
    expect(ver).toHaveLength(2)
    // Nada de opacity-0: la señal de navegación no se esconde.
    for (const v of ver) {
      expect(v.className, 'el chevron se esconde detrás de un hover').not.toMatch(/opacity-0/)
      expect(v.closest('span')?.className ?? '').not.toMatch(/opacity-0/)
    }
  })

  it('el chevron apunta a la URL de la fila', () => {
    render(<Table data={DATA} rowKey={r => r.id} columns={COLS} rowHref={r => `/contactos/${r.id}`} />)
    expect(screen.getAllByLabelText('Ver detalle')[0]).toHaveAttribute('href', '/contactos/c1')
  })

  it('clickear la fila navega', () => {
    render(<Table data={DATA} rowKey={r => r.id} columns={COLS} rowHref={r => `/contactos/${r.id}`} />)
    fireEvent.click(screen.getByText('Bruno Test'))
    expect(push).toHaveBeenCalledWith('/contactos/c2')
  })

  it('un botón de adentro de la fila NO dispara la navegación', () => {
    const onDelete = vi.fn()
    render(
      <Table
        data={DATA}
        rowKey={r => r.id}
        columns={COLS}
        rowHref={r => `/contactos/${r.id}`}
        actions={r => <button onClick={() => onDelete(r.id)}>Eliminar</button>}
      />,
    )
    fireEvent.click(screen.getAllByText('Eliminar')[0])
    expect(onDelete).toHaveBeenCalledWith('c1')
    expect(push, 'el click en el botón de la fila también navegó').not.toHaveBeenCalled()
  })

  it('las acciones SECUNDARIAS sí se esconden en hover — ésas no son navegación', () => {
    render(
      <Table
        data={DATA}
        rowKey={r => r.id}
        columns={COLS}
        actions={() => <button>Eliminar</button>}
      />,
    )
    const wrapper = screen.getAllByText('Eliminar')[0].parentElement!
    expect(wrapper.className).toMatch(/md:opacity-0/)
  })

  it('sin rowHref la fila no es clickeable', () => {
    render(<Table data={DATA} rowKey={r => r.id} columns={COLS} />)
    fireEvent.click(screen.getByText('Bruno Test'))
    expect(push).not.toHaveBeenCalled()
    expect(screen.queryByLabelText('Ver detalle')).toBeNull()
  })
})
