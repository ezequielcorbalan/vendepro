import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { Modal } from '../Modal'
import { overlayContract } from './overlay-contract'

afterEach(cleanup)

/**
 * El contrato tiene que fallar sobre un overlay armado a mano. Si pasara con
 * cualquier cosa, sería decoración y no serviría para la fase 6.
 *
 * `OverlayAMano` es el patrón exacto que tenía `AIChatPanel` antes de migrar
 * (commit 716510f) y que todavía tienen 17 archivos: scrim + panel, sin Portal,
 * sin Esc, sin scroll-lock y sin foco.
 */
function OverlayAMano({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div role="dialog" className="relative w-full max-w-md bg-white h-full">
        <button onClick={onClose}>Cerrar</button>
        <p>cuerpo</p>
      </div>
    </div>
  )
}

describe('el contrato de overlay detecta un overlay armado a mano', () => {
  const aMano = overlayContract(onClose => <OverlayAMano onClose={onClose} />)

  it('detecta que no cierra con Esc', () => {
    expect(() => aMano.cierraConEsc()).toThrow()
  })

  it('detecta que no bloquea el scroll del body', () => {
    expect(() => aMano.bloqueaYRestauraElScroll()).toThrow()
  })

  it('detecta que el foco no entra al panel', () => {
    expect(() => aMano.mueveElFocoAdentro()).toThrow()
  })

  it('detecta que el foco no vuelve al disparador', () => {
    expect(() => aMano.devuelveElFoco()).toThrow()
  })

  it('detecta que no se monta en un Portal', () => {
    expect(() => aMano.seMontaEnPortal()).toThrow()
  })

  it('detecta que no declara aria-modal', () => {
    expect(() => aMano.esDialogoModal()).toThrow()
  })
})

describe('Modal · contrato de overlay', () => {
  const contrato = overlayContract((onClose, body) => (
    <Modal open onClose={onClose} title="Publicar">{body ?? 'cuerpo'}</Modal>
  ))

  it('cierra con Escape', contrato.cierraConEsc)
  it('bloquea y restaura el scroll del body', contrato.bloqueaYRestauraElScroll)
  it('mueve el foco adentro del panel al abrir', contrato.mueveElFocoAdentro)
  it('devuelve el foco al disparador al cerrar', contrato.devuelveElFoco)
  it('se monta en un Portal, no en el árbol local', contrato.seMontaEnPortal)
  it('es un diálogo modal accesible', contrato.esDialogoModal)
  it('deja tipear adentro', contrato.dejaTipearAdentro)
})

describe('Modal · sheet', () => {
  /**
   * `sheet` salió de seis overlays idénticos armados a mano. Lo que importa no es
   * cómo se ve sino que el layout cambie en el breakpoint: pegado abajo en móvil,
   * centrado en desktop. Si esas clases se pierden, los seis quedan como diálogo
   * centrado en un teléfono, que es peor para trabajo de campo.
   */
  it('pega el panel abajo en móvil y lo centra en desktop', () => {
    render(<Modal open onClose={() => {}} title="T" sheet>cuerpo</Modal>)
    const scrim = screen.getByRole('dialog').parentElement!
    expect(scrim.className).toMatch(/items-end/)
    expect(scrim.className).toMatch(/sm:items-center/)
  })

  it('redondea sólo arriba en móvil y vuelve al radio de card en desktop', () => {
    render(<Modal open onClose={() => {}} title="T" sheet>cuerpo</Modal>)
    const panel = screen.getByRole('dialog')
    expect(panel.className).toMatch(/rounded-t-2xl/)
    expect(panel.className).toMatch(/sm:rounded-card/)
  })

  it('sin `sheet` sigue centrado, como antes', () => {
    render(<Modal open onClose={() => {}} title="T">cuerpo</Modal>)
    const scrim = screen.getByRole('dialog').parentElement!
    expect(scrim.className).toMatch(/items-center/)
    expect(scrim.className).not.toMatch(/items-end/)
    expect(screen.getByRole('dialog').className).not.toMatch(/rounded-t-2xl/)
  })

  it('cumple el contrato de overlay igual que el modal centrado', () => {
    const c = overlayContract((onClose, body) => (
      <Modal open onClose={onClose} title="T" sheet>{body ?? 'cuerpo'}</Modal>
    ))
    c.cierraConEsc()
    c.bloqueaYRestauraElScroll()
    c.mueveElFocoAdentro()
    c.seMontaEnPortal()
    // Los 6 overlays que estrenaron `sheet` son todos formularios, así que éste
    // es el chequeo que más importa acá: sin el fix de `useOverlay` (onClose por
    // ref) el foco se iba del input en la primera tecla.
    c.dejaTipearAdentro()
  })
})

describe('Modal · un formulario largo no se corta', () => {
  /**
   * El panel tiene `overflow-hidden`, así que si el cuerpo no scrollea por su
   * cuenta el contenido que no entra queda RECORTADO, no oculto-pero-alcanzable:
   * en un teléfono el final de un formulario se vuelve inalcanzable y no hay
   * forma de darse cuenta mirando una captura. Esto pasó migrando el modal de
   * "Nuevo lead": puse el `overflow-y-auto` en un nieto del panel, donde el
   * `flex` no llega.
   *
   * jsdom no calcula layout, así que lo que se puede afirmar es la estructura,
   * que es justamente lo que estaba mal: quién scrollea y quién queda afuera.
   */
  function abrirLargo() {
    render(
      <Modal open onClose={() => {}} title="Nuevo lead" footer={<button>Crear</button>}>
        {Array.from({ length: 60 }, (_, i) => <p key={i}>campo {i}</p>)}
      </Modal>,
    )
    return screen.getByRole('dialog')
  }

  it('acota el panel al alto de la pantalla y lo apila en columna', () => {
    const panel = abrirLargo()
    expect(panel.className).toMatch(/max-h-\[90vh\]/)
    expect(panel.className).toMatch(/flex-col/)
  })

  it('el cuerpo scrollea y puede encogerse dentro del flex', () => {
    const panel = abrirLargo()
    const cuerpo = screen.getByText('campo 0').parentElement!
    expect(cuerpo.parentElement).toBe(panel)
    expect(cuerpo.className).toMatch(/overflow-y-auto/)
    // Sin `min-h-0` un hijo de flex no baja de su tamaño de contenido y el
    // overflow-y-auto no llega a activarse nunca.
    expect(cuerpo.className).toMatch(/min-h-0/)
  })

  it('el encabezado y el footer quedan afuera del área que scrollea', () => {
    const panel = abrirLargo()
    const cuerpo = screen.getByText('campo 0').parentElement!
    const titulo = screen.getByRole('heading', { name: 'Nuevo lead' })
    const boton = screen.getByRole('button', { name: 'Crear' })
    expect(cuerpo.contains(titulo)).toBe(false)
    expect(cuerpo.contains(boton)).toBe(false)
    // y no se encogen cuando el cuerpo empuja
    expect(titulo.closest('div')!.parentElement!.className).toMatch(/shrink-0/)
    expect(boton.parentElement!.className).toMatch(/shrink-0/)
  })
})
