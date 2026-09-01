import { expect, vi } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import type { ReactElement } from 'react'

/**
 * Contrato de overlay: las cinco cosas que un panel modal tiene que hacer y que
 * ninguna se ve en una captura de pantalla.
 *
 * Existe para la fase 6 (ver doc/ds-plan-fase6.md). Al migrar un overlay armado
 * a mano a `ui/Modal` o `ui/Drawer`, el test del consumidor son tres líneas:
 *
 *   describe('MiPanel', () => {
 *     expectOverlayContract(onClose => <MiPanel open onClose={onClose} />)
 *   })
 *
 * El motivo de que sea un helper y no un test copiado: 18 overlays a mano en 17
 * archivos, de los que 3 cerraban con Esc y 0 devolvían el foco. Si el contrato
 * vive en un solo lugar, migrar deja de depender de que alguien se acuerde de
 * probar las cinco cosas a mano.
 */
export function overlayContract(renderOverlay: (onClose: () => void) => ReactElement) {
  return {
    /** 1. Cierra con Esc. Es el que más faltaba: un panel que atrapa la
     *     atención y no se puede cerrar con el teclado. */
    cierraConEsc() {
      const onClose = vi.fn()
      render(renderOverlay(onClose))
      fireEvent.keyDown(document, { key: 'Escape' })
      expect(onClose, 'el overlay no cierra con Escape').toHaveBeenCalled()
      cleanup()
    },

    /** 2. Bloquea el scroll del body mientras está abierto, y lo restaura al
     *     desmontarse — restaura el valor PREVIO, no un hardcode. */
    bloqueaYRestauraElScroll() {
      document.body.style.overflow = 'auto'
      const { unmount } = render(renderOverlay(() => {}))
      expect(document.body.style.overflow, 'no bloquea el scroll del body').toBe('hidden')
      unmount()
      expect(document.body.style.overflow, 'no restaura el scroll previo del body').toBe('auto')
      document.body.style.overflow = ''
      cleanup()
    },

    /** 3. El foco entra al panel al abrir. Sin esto el teclado sigue en la
     *     página de atrás. */
    mueveElFocoAdentro() {
      render(renderOverlay(() => {}))
      const dialog = screen.getByRole('dialog')
      expect(
        dialog.contains(document.activeElement),
        'el foco quedó fuera del panel al abrir',
      ).toBe(true)
      cleanup()
    },

    /** 4. Devuelve el foco al elemento que lo abrió.
     *
     *     Afirma el ciclo COMPLETO —salió del disparador al abrir, volvió al
     *     cerrar— y no sólo la vuelta. Si sólo mirara la vuelta, un overlay que
     *     nunca movió el foco pasaría el test: el foco "sigue" en el disparador
     *     porque nunca se fue. Eso es justo lo que hacía la primera versión de
     *     este helper, y lo cazó el self-test de overlay-contract.test.tsx. */
    devuelveElFoco() {
      const disparador = document.createElement('button')
      disparador.textContent = 'abrir'
      document.body.appendChild(disparador)
      disparador.focus()

      const { unmount } = render(renderOverlay(() => {}))
      expect(
        document.activeElement,
        'el foco nunca salió del disparador al abrir, así que la devolución no significa nada',
      ).not.toBe(disparador)

      unmount()
      expect(document.activeElement, 'el foco no volvió al disparador').toBe(disparador)

      disparador.remove()
      cleanup()
    },

    /** 5. Se monta en un Portal (hijo de body), no en el árbol donde se declaró:
     *     si no, un ancestro con overflow:hidden o transform lo recorta. */
    seMontaEnPortal() {
      const { container } = render(renderOverlay(() => {}))
      const dialog = screen.getByRole('dialog')
      expect(
        container.contains(dialog),
        'el overlay se montó en el árbol local en vez de un Portal',
      ).toBe(false)
      cleanup()
    },

    /** Accesible como diálogo modal. */
    esDialogoModal() {
      render(renderOverlay(() => {}))
      expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true')
      cleanup()
    },
  }
}
