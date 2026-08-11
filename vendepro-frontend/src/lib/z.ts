/**
 * Escala de z-index del design system (capas de overlays). Fuente única, para
 * que un dropdown/tooltip dentro de un modal quede por encima y no debajo.
 * Orden (abajo → arriba): overlay < modal/drawer < dropdown < tooltip < toast.
 */
export const Z = {
  overlay: 50,   // scrim de modal/drawer
  modal: 60,     // panel de modal/drawer
  dropdown: 70,  // menús/popovers (por encima del modal para funcionar adentro)
  tooltip: 80,
  toast: 100,
} as const
