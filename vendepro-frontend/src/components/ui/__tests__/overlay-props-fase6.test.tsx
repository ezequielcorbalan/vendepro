import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { Modal } from '../Modal'
import { Drawer } from '../Drawer'

afterEach(cleanup)

/**
 * Los tres props que cerraron la fase 6. Cada uno salió de un overlay que estaba
 * armado a mano justo porque el DS no lo soportaba, así que lo que se afirma acá
 * es lo que hacía que ese overlay existiera por separado.
 */
describe('Drawer · side', () => {
  it('por default entra por la derecha', () => {
    render(<Drawer open onClose={() => {}} title="T">cuerpo</Drawer>)
    expect(screen.getByRole('dialog').parentElement!.className).toMatch(/justify-end/)
  })

  it('con side="left" entra por la izquierda', () => {
    render(<Drawer open onClose={() => {}} title="T" side="left">cuerpo</Drawer>)
    const scrim = screen.getByRole('dialog').parentElement!
    expect(scrim.className).toMatch(/justify-start/)
    expect(scrim.className).not.toMatch(/justify-end/)
  })

  it('el className llega al scrim, no sólo al panel', () => {
    // El nav móvil pasa `lg:hidden`: si cayera en el panel, el fondo negro
    // seguiría tapando el desktop entero.
    render(<Drawer open onClose={() => {}} title="T" side="left" className="lg:hidden">x</Drawer>)
    expect(screen.getByRole('dialog').parentElement!.className).toMatch(/lg:hidden/)
  })
})

describe('Modal · align', () => {
  it('por default centra vertical', () => {
    render(<Modal open onClose={() => {}} title="T">cuerpo</Modal>)
    expect(screen.getByRole('dialog').parentElement!.className).toMatch(/items-center/)
  })

  it('con align="top" ancla arriba', () => {
    render(<Modal open onClose={() => {}} title="T" align="top">cuerpo</Modal>)
    const scrim = screen.getByRole('dialog').parentElement!
    expect(scrim.className).toMatch(/items-start/)
    expect(scrim.className).not.toMatch(/items-center/)
  })

  it('sheet le gana a align, como dice el docblock', () => {
    render(<Modal open onClose={() => {}} title="T" sheet align="top">cuerpo</Modal>)
    const scrim = screen.getByRole('dialog').parentElement!
    expect(scrim.className).toMatch(/items-end/)
    expect(scrim.className).not.toMatch(/items-start/)
  })
})

describe('Modal · header', () => {
  it('renderiza el slot en vez del título, y la X la sigue poniendo el Modal', () => {
    render(
      <Modal open onClose={() => {}} title="Bienvenida" header={<span>pasos</span>}>
        cuerpo
      </Modal>,
    )
    expect(screen.getByText('pasos')).toBeInTheDocument()
    // el `title` sigue siendo el nombre accesible del diálogo
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-label', 'Bienvenida')
    expect(screen.queryByRole('heading', { name: 'Bienvenida' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Cerrar' })).toBeInTheDocument()
  })

  it('sin header ni title no dibuja encabezado — el caso de la paleta ⌘K', () => {
    render(<Modal open onClose={() => {}} padded={false}>cuerpo</Modal>)
    expect(screen.queryByRole('button', { name: 'Cerrar' })).toBeNull()
  })
})

describe('Modal · el cuerpo crece pero no colapsa', () => {
  /**
   * El onboarding pone el alto fijo en el PANEL para que el último paso (sin
   * footer) no cambie el tamaño del modal. Para que eso funcione el cuerpo tiene
   * que crecer y llenar lo que sobra: por eso es `grow` (basis auto) y no
   * `flex-1` (basis 0), que en un panel de alto automático colapsaría el cuerpo
   * a cero.
   */
  it('el cuerpo usa grow, no flex-1', () => {
    render(<Modal open onClose={() => {}} title="T">cuerpo</Modal>)
    const cuerpo = screen.getByText('cuerpo')
    expect(cuerpo.className).toMatch(/\bgrow\b/)
    expect(cuerpo.className).not.toMatch(/flex-1/)
  })
})
