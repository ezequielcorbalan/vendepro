import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import { Building2 } from 'lucide-react'
import { ComparablePickerModal, type ComparableSource } from '../ComparablePickerModal'
import { overlayContract } from '@/components/ui/__tests__/overlay-contract'

afterEach(cleanup)

interface Item { id: string; nombre: string; barrio: string; precio: number }

const ITEMS: Item[] = [
  { id: '1', nombre: 'Santo Tomé 3309', barrio: 'Villa Urquiza', precio: 180000 },
  { id: '2', nombre: 'Av. Cabildo 2200', barrio: 'Belgrano', precio: 240000 },
]

function fuente(over: Partial<ComparableSource<Item>> = {}): ComparableSource<Item> {
  return {
    title: 'Elegir desde algo',
    icon: <Building2 className="w-5 h-5" />,
    searchPlaceholder: 'Buscar…',
    load: async () => ITEMS,
    rowKey: i => i.id,
    searchable: i => `${i.nombre} ${i.barrio}`,
    toRow: i => ({ title: i.nombre, meta: [i.barrio], amountLabel: 'Listado', amount: `USD ${i.precio}` }),
    toComparable: i => ({ kind: 'publicacion', address: i.nombre } as any),
    emptyTitle: 'No hay nada cargado.',
    emptyFiltered: 'Nada coincide con los filtros.',
    ...over,
  }
}

/**
 * `PropertiesPickerModal` y `SoldPropertiesPickerModal` eran la misma pantalla
 * duplicada, sin Portal, sin Esc y sin foco. Ahora las dos son fuentes sobre
 * este componente, así que el contrato se testea una vez.
 */
const contrato = overlayContract(onClose => (
  <ComparablePickerModal open onClose={onClose} onPick={() => {}} source={fuente()} />
))

describe('ComparablePickerModal · contrato de overlay', () => {
  it('cierra con Escape', contrato.cierraConEsc)
  it('bloquea y restaura el scroll del body', contrato.bloqueaYRestauraElScroll)
  it('mueve el foco adentro del panel al abrir', contrato.mueveElFocoAdentro)
  it('devuelve el foco al disparador al cerrar', contrato.devuelveElFoco)
  it('se monta en un Portal, no en el árbol local', contrato.seMontaEnPortal)
  it('es un diálogo modal accesible', contrato.esDialogoModal)
})

describe('ComparablePickerModal', () => {
  it('lista lo que trae la fuente y lo dibuja con toRow', async () => {
    render(<ComparablePickerModal open onClose={() => {}} onPick={() => {}} source={fuente()} />)
    expect(await screen.findByText('Santo Tomé 3309')).toBeInTheDocument()
    expect(screen.getByText('Av. Cabildo 2200')).toBeInTheDocument()
    expect(screen.getByText('USD 180000')).toBeInTheDocument()
  })

  it('el buscador filtra en cliente sobre `searchable`', async () => {
    render(<ComparablePickerModal open onClose={() => {}} onPick={() => {}} source={fuente()} />)
    await screen.findByText('Santo Tomé 3309')

    fireEvent.change(screen.getByLabelText('Buscar'), { target: { value: 'belgrano' } })

    expect(screen.queryByText('Santo Tomé 3309')).toBeNull()
    expect(screen.getByText('Av. Cabildo 2200')).toBeInTheDocument()
  })

  it('elegir un ítem devuelve el comparable mapeado y cierra', async () => {
    const onPick = vi.fn()
    const onClose = vi.fn()
    render(<ComparablePickerModal open onClose={onClose} onPick={onPick} source={fuente()} />)

    fireEvent.click(await screen.findByText('Santo Tomé 3309'))

    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ address: 'Santo Tomé 3309' }))
    expect(onClose).toHaveBeenCalled()
  })

  it('un filtro `server` recarga desde la fuente; uno de cliente no', async () => {
    const load = vi.fn(async () => ITEMS)
    render(
      <ComparablePickerModal
        open onClose={() => {}} onPick={() => {}}
        source={fuente({
          load,
          filters: [
            { key: 'tipo', placeholder: 'Tipo', kind: 'select', server: true, options: [{ value: 'casa', label: 'Casa' }] },
            { key: 'barrio', placeholder: 'Barrio', kind: 'text' },
          ],
          matches: (i, f) => !f.barrio || i.barrio.toLowerCase().includes(f.barrio.toLowerCase()),
        })}
      />,
    )
    await screen.findByText('Santo Tomé 3309')
    expect(load).toHaveBeenCalledTimes(1)

    // Filtro de servidor: recarga, y le llega el valor.
    fireEvent.change(screen.getByLabelText('Tipo'), { target: { value: 'casa' } })
    await waitFor(() => expect(load).toHaveBeenCalledTimes(2))
    expect(load).toHaveBeenLastCalledWith({ tipo: 'casa' })

    // Filtro de cliente: NO recarga, filtra lo que ya está.
    fireEvent.change(screen.getByLabelText('Barrio'), { target: { value: 'belgrano' } })
    expect(load).toHaveBeenCalledTimes(2)
    expect(screen.queryByText('Santo Tomé 3309')).toBeNull()
  })

  it('distingue "no hay nada cargado" de "nada coincide con el filtro"', async () => {
    const { unmount } = render(
      <ComparablePickerModal open onClose={() => {}} onPick={() => {}}
        source={fuente({ load: async () => [] })} />,
    )
    expect(await screen.findByText('No hay nada cargado.')).toBeInTheDocument()
    unmount()

    render(<ComparablePickerModal open onClose={() => {}} onPick={() => {}} source={fuente()} />)
    await screen.findByText('Santo Tomé 3309')
    fireEvent.change(screen.getByLabelText('Buscar'), { target: { value: 'zzzz' } })
    expect(screen.getByText('Nada coincide con los filtros.')).toBeInTheDocument()
  })
})
