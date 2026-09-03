import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { Drawer } from '../Drawer'
import { overlayContract } from './overlay-contract'

afterEach(cleanup)

const contrato = overlayContract((onClose, body) => (
  <Drawer open onClose={onClose} title="Configuración">
    {body ?? <p>cuerpo</p>}
  </Drawer>
))

describe('Drawer · contrato de overlay', () => {
  it('cierra con Escape', contrato.cierraConEsc)
  it('bloquea y restaura el scroll del body', contrato.bloqueaYRestauraElScroll)
  it('mueve el foco adentro del panel al abrir', contrato.mueveElFocoAdentro)
  it('devuelve el foco al disparador al cerrar', contrato.devuelveElFoco)
  it('se monta en un Portal, no en el árbol local', contrato.seMontaEnPortal)
  it('deja tipear adentro sin perder el foco ni cerrarse', contrato.dejaTipearAdentro)
  it('es un diálogo modal accesible', contrato.esDialogoModal)
})

describe('Drawer', () => {
  it('no renderiza nada cuando open=false', () => {
    render(<Drawer open={false} onClose={() => {}} title="T">contenido</Drawer>)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('`header` reemplaza al título de una línea y conserva la X del Drawer', () => {
    render(
      <Drawer
        open
        onClose={() => {}}
        header={<span>Asistente IA</span>}
      >
        cuerpo
      </Drawer>,
    )
    expect(screen.getByText('Asistente IA')).toBeInTheDocument()
    // La X la sigue poniendo el Drawer, no el llamador.
    expect(screen.getByRole('button', { name: 'Cerrar' })).toBeInTheDocument()
  })

  it('`padded=false` saca el padding del cuerpo, para contenido a sangre', () => {
    const { unmount } = render(
      <Drawer open onClose={() => {}} title="T" padded={false}>
        <p>a sangre</p>
      </Drawer>,
    )
    const cuerpo = screen.getByText('a sangre').parentElement!
    expect(cuerpo.className).not.toMatch(/px-5/)
    unmount()

    render(<Drawer open onClose={() => {}} title="T"><p>con padding</p></Drawer>)
    expect(screen.getByText('con padding').parentElement!.className).toMatch(/px-5/)
  })

  it('el click en el scrim cierra; el click adentro del panel no', () => {
    const onClose = vi.fn()
    render(<Drawer open onClose={onClose} title="T"><p>cuerpo</p></Drawer>)

    const dialog = screen.getByRole('dialog')
    // Adentro: no cierra.
    dialog.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    dialog.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
    expect(onClose).not.toHaveBeenCalled()

    // En el scrim: cierra. mousedown Y mouseup tienen que caer ahí, para no
    // cerrar cuando se suelta afuera después de seleccionar texto adentro.
    const scrim = dialog.parentElement!
    scrim.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    scrim.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
