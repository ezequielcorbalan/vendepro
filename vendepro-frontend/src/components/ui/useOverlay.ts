'use client'

import { useEffect, type RefObject } from 'react'

const FOCUSABLE = 'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])'

/**
 * Comportamiento base de un overlay (Modal/Drawer): cierre con Esc, bloqueo de
 * scroll del body, foco al panel al abrir + trap de Tab dentro del panel, y
 * devolución del foco al elemento previo al cerrar.
 */
export function useOverlay(open: boolean, onClose: () => void, panelRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!open) return
    const prevActive = document.activeElement as HTMLElement | null
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const panel = panelRef.current
    const focusables = () =>
      Array.from(panel?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []).filter(el => el.offsetParent !== null)

    // Foco inicial: primer focusable, o el panel mismo.
    const first = focusables()[0]
    ;(first ?? panel)?.focus()

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return }
      if (e.key !== 'Tab' || !panel) return
      const els = focusables()
      if (els.length === 0) { e.preventDefault(); return }
      const firstEl = els[0]
      const lastEl = els[els.length - 1]
      if (e.shiftKey && document.activeElement === firstEl) { e.preventDefault(); lastEl.focus() }
      else if (!e.shiftKey && document.activeElement === lastEl) { e.preventDefault(); firstEl.focus() }
    }

    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
      prevActive?.focus?.()
    }
  }, [open, onClose, panelRef])
}
