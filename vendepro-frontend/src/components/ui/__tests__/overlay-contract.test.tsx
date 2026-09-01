import { describe, it, expect, afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
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
  const contrato = overlayContract(onClose => (
    <Modal open onClose={onClose} title="Publicar">cuerpo</Modal>
  ))

  it('cierra con Escape', contrato.cierraConEsc)
  it('bloquea y restaura el scroll del body', contrato.bloqueaYRestauraElScroll)
  it('mueve el foco adentro del panel al abrir', contrato.mueveElFocoAdentro)
  it('devuelve el foco al disparador al cerrar', contrato.devuelveElFoco)
  it('se monta en un Portal, no en el árbol local', contrato.seMontaEnPortal)
  it('es un diálogo modal accesible', contrato.esDialogoModal)
})
