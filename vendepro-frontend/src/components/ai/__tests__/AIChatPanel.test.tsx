import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import AIChatPanel from '../AIChatPanel'
import { ToastProvider } from '@/components/ui/Toast'
import { overlayContract } from '@/components/ui/__tests__/overlay-contract'

afterEach(cleanup)

/**
 * Primer consumidor migrado de la fase 6 (commit 716510f). Antes se dibujaba su
 * propio drawer y por eso no cerraba con Esc, no bloqueaba el scroll y no tocaba
 * el foco. Estos seis tests son el contrato que cualquier overlay migrado tiene
 * que cumplir — ver doc/ds-plan-fase6.md.
 */
const contrato = overlayContract(onClose => (
  <ToastProvider>
    <AIChatPanel onClose={onClose} />
  </ToastProvider>
))

describe('AIChatPanel · contrato de overlay', () => {
  it('cierra con Escape', contrato.cierraConEsc)
  it('bloquea y restaura el scroll del body', contrato.bloqueaYRestauraElScroll)
  it('mueve el foco adentro del panel al abrir', contrato.mueveElFocoAdentro)
  it('devuelve el foco al disparador al cerrar', contrato.devuelveElFoco)
  it('se monta en un Portal, no en el árbol local', contrato.seMontaEnPortal)
  it('es un diálogo modal accesible', contrato.esDialogoModal)
})

describe('AIChatPanel', () => {
  it('el modo se elige con las Tabs del DS, no con botones a mano', () => {
    render(
      <ToastProvider>
        <AIChatPanel onClose={() => {}} />
      </ToastProvider>,
    )
    // Tabs del DS: role="tab" y aria-selected en el activo.
    const tabs = screen.getAllByRole('tab')
    expect(tabs.map(t => t.textContent)).toEqual(['Texto', 'Imagen'])
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true')
  })

  it('el textarea es el del DS y conserva el anillo de foco del teclado', () => {
    render(
      <ToastProvider>
        <AIChatPanel onClose={() => {}} />
      </ToastProvider>,
    )
    const ta = screen.getByRole('textbox')
    // La versión a mano traía `focus:outline-none`, que se come el anillo.
    expect(ta.className).not.toMatch(/focus:outline-none/)
    // Y el foco inicial va ahí.
    expect(document.activeElement).toBe(ta)
  })
})
