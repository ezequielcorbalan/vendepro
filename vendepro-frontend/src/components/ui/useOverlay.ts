'use client'

import { useEffect, type RefObject } from 'react'

const FOCUSABLE = 'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])'

/**
 * Bloqueo de scroll compartido entre overlays. Con dos abiertos a la vez (un
 * Drawer sobre un Modal, por ejemplo), cada uno guardaba y restauraba el estilo
 * por su cuenta y el último en cerrar dejaba el body en `hidden`: la página
 * quedaba sin scroll. Se cuenta cuántos hay abiertos y sólo el primero guarda
 * el valor y el último lo restaura.
 */
let openOverlays = 0
let savedOverflow = ''

function lockScroll() {
  if (openOverlays === 0) savedOverflow = document.body.style.overflow
  openOverlays += 1
  document.body.style.overflow = 'hidden'
}

function unlockScroll() {
  openOverlays = Math.max(0, openOverlays - 1)
  if (openOverlays === 0) document.body.style.overflow = savedOverflow
}

/**
 * Comportamiento base de un overlay (Modal/Drawer): cierre con Esc, bloqueo de
 * scroll del body, foco al panel al abrir + trap de Tab dentro del panel, y
 * devolución del foco al elemento previo al cerrar.
 */
export function useOverlay(open: boolean, onClose: () => void, panelRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!open) return
    const prevActive = document.activeElement as HTMLElement | null
    lockScroll()

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
      unlockScroll()
      prevActive?.focus?.()
    }
  }, [open, onClose, panelRef])
}
