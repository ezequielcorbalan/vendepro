import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { Modal } from '../Modal'
import { Drawer } from '../Drawer'

afterEach(() => {
  cleanup()
  document.body.style.overflow = ''
})

describe('useOverlay — bloqueo de scroll', () => {
  it('un overlay bloquea el scroll y lo devuelve al cerrar', () => {
    const { rerender } = render(<Modal open onClose={() => {}}>cuerpo</Modal>)
    expect(document.body.style.overflow).toBe('hidden')
    rerender(<Modal open={false} onClose={() => {}}>cuerpo</Modal>)
    expect(document.body.style.overflow).toBe('')
  })

  it('dos overlays anidados: el scroll vuelve sólo cuando se cierran los dos', () => {
    // Regresión: cada overlay guardaba el estilo por su cuenta, así que al
    // cerrar el segundo restauraba el 'hidden' que había dejado el primero y la
    // página quedaba sin scroll.
    const Both = ({ modal, drawer }: { modal: boolean; drawer: boolean }) => (
      <>
        <Modal open={modal} onClose={() => {}}>fondo</Modal>
        <Drawer open={drawer} onClose={() => {}} side="left">menú</Drawer>
      </>
    )

    const { rerender } = render(<Both modal drawer={false} />)
    expect(document.body.style.overflow).toBe('hidden')

    rerender(<Both modal drawer />)
    expect(document.body.style.overflow).toBe('hidden')

    // Se cierra el drawer: el modal sigue abierto, el scroll sigue bloqueado.
    rerender(<Both modal drawer={false} />)
    expect(document.body.style.overflow).toBe('hidden')

    // Se cierra el modal: recién ahí vuelve el scroll.
    rerender(<Both modal={false} drawer={false} />)
    expect(document.body.style.overflow).toBe('')
  })
})
