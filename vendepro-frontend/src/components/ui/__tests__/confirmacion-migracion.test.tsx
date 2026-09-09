import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { Drawer } from '../Drawer'
import { Button } from '../Button'
import { useConfirm } from '../useConfirm'
import BlockListSidebar from '@/components/landings/BlockListSidebar'
import type { Block } from '@/lib/landings/types'

/**
 * La migración de los `confirm()` nativos al diálogo del DS (regla 29).
 *
 * Lo que se rompe si esto no está: la acción destructiva se ejecuta igual
 * cuando el usuario cancela. Con `window.confirm` era imposible equivocarse
 * —devuelve un booleano y corta ahí mismo—, pero `askConfirm` es una promesa,
 * así que si alguien se olvida del `await` o del `if (!confirmed) return` el
 * borrado pasa de todas formas y el diálogo no sirve para nada.
 *
 * Los dos casos que se testean acá son los que NO eran un reemplazo mecánico:
 * la confirmación tuvo que subir de la fila al padre (BlockListSidebar y
 * EditableCanvas), porque el `onRemove` de la fila es un closure sin id.
 */

function Anfitrion({ onBorrar }: { onBorrar: () => void }) {
  const { confirmDialog, askConfirm } = useConfirm()
  async function pedir() {
    const { confirmed } = await askConfirm({
      title: 'Eliminar cosa',
      message: 'No se puede deshacer.',
      confirmLabel: 'Eliminar',
      variant: 'danger',
    })
    if (confirmed) onBorrar()
  }
  return (
    <>
      {confirmDialog}
      <Button onClick={pedir}>Borrar</Button>
    </>
  )
}

describe('confirmación del DS en vez de confirm() nativo', () => {
  it('no ejecuta la acción si el usuario cancela', async () => {
    const onBorrar = vi.fn()
    render(<Anfitrion onBorrar={onBorrar} />)
    fireEvent.click(screen.getByRole('button', { name: 'Borrar' }))
    await screen.findByText('Eliminar cosa')
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    await waitFor(() => expect(screen.queryByText('Eliminar cosa')).not.toBeInTheDocument())
    expect(onBorrar).not.toHaveBeenCalled()
  })

  it('ejecuta la acción una sola vez si confirma', async () => {
    const onBorrar = vi.fn()
    render(<Anfitrion onBorrar={onBorrar} />)
    fireEvent.click(screen.getByRole('button', { name: 'Borrar' }))
    await screen.findByText('Eliminar cosa')
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar' }))
    await waitFor(() => expect(onBorrar).toHaveBeenCalledTimes(1))
  })

  it('un diálogo abierto dentro de un Drawer queda por encima del Drawer', async () => {
    // VersionsDrawer confirma el rollback desde adentro de un Drawer. Los dos
    // usan el mismo z-index (`Z.modal`), así que lo único que los ordena es el
    // orden en el DOM: el diálogo monta después, y por eso queda arriba. Si
    // alguien le baja el z-index al Modal, la confirmación queda tapada y el
    // usuario no puede contestarla.
    render(
      <Drawer open onClose={() => {}} title="Historial">
        <Anfitrion onBorrar={() => {}} />
      </Drawer>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Borrar' }))
    const dialogo = await screen.findByText('Eliminar cosa')

    const overlays = Array.from(document.body.querySelectorAll<HTMLElement>('.fixed.inset-0'))
    expect(overlays.length).toBe(2)
    const elDelDialogo = overlays.findIndex(o => o.contains(dialogo))
    expect(elDelDialogo).toBe(overlays.length - 1)
    expect(overlays[0].style.zIndex).toBe(overlays[1].style.zIndex)
  })
})

describe('BlockListSidebar: la confirmación vive en el padre', () => {
  const bloques: Block[] = [
    { id: 'b1', type: 'gallery', visible: true, data: {} } as Block,
    { id: 'b2', type: 'benefits-list', visible: true, data: {} } as Block,
  ]

  function montar(onRemove: (id: string) => Promise<void>) {
    return render(
      <BlockListSidebar
        blocks={bloques}
        selectedId={null}
        onSelect={() => {}}
        onReorder={() => {}}
        onRemove={onRemove}
        onToggleVisibility={() => {}}
        onAdd={async () => {}}
      />,
    )
  }

  it('hay UN diálogo para toda la lista, no uno por bloque', async () => {
    montar(async () => {})
    const papeleras = screen.getAllByTitle('Eliminar')
    expect(papeleras.length).toBe(2)
    fireEvent.click(papeleras[0])
    // Un solo título, aunque haya dos filas con botón de borrar.
    expect(await screen.findAllByText('Eliminar bloque')).toHaveLength(1)
  })

  it('borra el bloque de la fila que se clickeó, y sólo si se confirma', async () => {
    const onRemove = vi.fn(async () => {})
    montar(onRemove)
    fireEvent.click(screen.getAllByTitle('Eliminar')[1])
    await screen.findByText('Eliminar bloque')
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    await waitFor(() => expect(screen.queryByText('Eliminar bloque')).not.toBeInTheDocument())
    expect(onRemove).not.toHaveBeenCalled()

    fireEvent.click(screen.getAllByTitle('Eliminar')[1])
    await screen.findByText('Eliminar bloque')
    // Dentro del diálogo: las papeleras de las filas también se llaman
    // "Eliminar" (les da el nombre su `title`), así que buscar por rol suelto
    // encuentra tres botones y no uno.
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Eliminar' }))
    await waitFor(() => expect(onRemove).toHaveBeenCalledWith('b2'))
  })
})
