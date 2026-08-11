'use client'

import { type ReactNode } from 'react'
import { createPortal } from 'react-dom'

/**
 * Renderiza children en document.body (fuera del árbol), para que overlays
 * (Modal/Drawer) no queden atrapados por ancestros con overflow:hidden o
 * transform. Los overlays sólo se montan por interacción (post-hidratación),
 * así que el portal es síncrono en cliente (sin delay) y el ref del panel ya
 * está disponible para el foco.
 */
export function Portal({ children }: { children: ReactNode }) {
  if (typeof document === 'undefined') return null
  return createPortal(children, document.body)
}
