import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { Modal } from '../Modal'
import { Drawer } from '../Drawer'
import { Button } from '../Button'
import { PillCheckGroup } from '../ChoicePills'
import { ToastProvider } from '../Toast'

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

describe('Button · el alto lo define el botón, no la fila', () => {
  /**
   * Un contenedor `flex items-stretch` estiraba el botón hasta el alto de su
   * vecino: medido en /configuracion/api, el bloque del token medía 2178px en
   * ventana angosta y el botón se iba con él. `h-fit` no es `auto`, así que
   * `align-items: stretch` deja de aplicarle.
   *
   * No se fija un alto POR TAMAÑO a propósito: hay ~15 botones en la app cuyo
   * alto sale de un `py-*` propio y todos cambiarían de tamaño.
   */
  it('trae h-fit en la base', () => {
    render(<Button>Copiar</Button>)
    expect(screen.getByRole('button', { name: 'Copiar' }).className).toMatch(/\bh-fit\b/)
  })

  it('no impone un alto por tamaño, así que un py- propio sigue mandando', () => {
    render(<Button size="sm" className="py-3">Alto</Button>)
    const c = screen.getByRole('button', { name: 'Alto' }).className
    expect(c).toMatch(/\bpy-3\b/)
    expect(c).not.toMatch(/\bh-(7|8|9|10)\b/)
  })
})

describe('ChoicePills · size', () => {
  it('por default mantiene el tamaño de siempre', () => {
    render(<PillCheckGroup options={[{ value: 'a', label: 'A' }]} value={[]} onChange={() => {}} />)
    expect(screen.getByRole('button', { name: 'A' }).className).toMatch(/px-4 py-2/)
  })

  it('con size="sm" iguala al Button size="sm" para convivir en la misma fila', () => {
    render(<PillCheckGroup size="sm" options={[{ value: 'a', label: 'A' }]} value={[]} onChange={() => {}} />)
    expect(screen.getByRole('button', { name: 'A' }).className).toMatch(/text-xs px-3 py-1\.5/)
  })
})

describe('Toast · no lo tapa el botón flotante', () => {
  /**
   * El botón flotante de IA está en `bottom-6 right-6` y montado en el layout
   * del dashboard, o sea en TODAS las pantallas. Con el toast en `bottom-4` se
   * pisaban y el mensaje quedaba tapado a la mitad — Paula lo vio con un
   * "Internal server error" ilegible. El z-index no era el problema (toast
   * z-100, botón z-40): ocupaban la misma esquina.
   */
  it('el contenedor sube por encima del botón flotante', () => {
    const { container } = render(
      <ToastProvider><span /></ToastProvider>,
    )
    const cont = container.parentElement!.querySelector('.fixed.z-\\[100\\]')
      ?? document.querySelector('.fixed.z-\\[100\\]')
    expect(cont).not.toBeNull()
    expect(cont!.className).toMatch(/bottom-24/)
    expect(cont!.className).not.toMatch(/bottom-4\b/)
  })
})
