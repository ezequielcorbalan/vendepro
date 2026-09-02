import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import ConfigDrawer from '../ConfigDrawer'
import { overlayContract } from '@/components/ui/__tests__/overlay-contract'

afterEach(cleanup)

const landing = {
  id: 'l_1',
  slug_base: 'depto-palermo',
  slug_suffix: 'a1b2',
  brand_voice: null,
  seo_title: null,
  seo_description: null,
  og_image_url: null,
  lead_rules: {},
} as any

/**
 * Tanda 2 de la fase 6: este drawer se dibujaba a mano
 * (`fixed inset-0` + `<aside absolute right-0>`), así que no cerraba con Esc, no
 * bloqueaba el scroll y no tocaba el foco. Ahora es el `Drawer` del DS.
 */
const contrato = overlayContract(onClose => (
  <ConfigDrawer landing={landing} onClose={onClose} onSaved={async () => {}} />
))

describe('ConfigDrawer · contrato de overlay', () => {
  it('cierra con Escape', contrato.cierraConEsc)
  it('bloquea y restaura el scroll del body', contrato.bloqueaYRestauraElScroll)
  it('mueve el foco adentro del panel al abrir', contrato.mueveElFocoAdentro)
  it('devuelve el foco al disparador al cerrar', contrato.devuelveElFoco)
  it('se monta en un Portal, no en el árbol local', contrato.seMontaEnPortal)
  it('es un diálogo modal accesible', contrato.esDialogoModal)
})

describe('ConfigDrawer', () => {
  it('el Guardar queda en el footer del Drawer, no suelto en el cuerpo', () => {
    render(<ConfigDrawer landing={landing} onClose={() => {}} onSaved={async () => {}} />)
    const guardar = screen.getByRole('button', { name: /Guardar/ })
    const footer = guardar.closest('.border-t')
    expect(footer, 'el botón Guardar no está en el footer del Drawer').not.toBeNull()
  })

  it('precarga los campos desde la landing', () => {
    render(<ConfigDrawer landing={landing} onClose={() => {}} onSaved={async () => {}} />)
    expect(screen.getByDisplayValue('depto-palermo')).toBeInTheDocument()
  })
})
