'use client'

import { createContext, useContext } from 'react'

/**
 * ¿Este árbol está renderizándose DENTRO del menú de tres puntos de un
 * `ActionGroup`?
 *
 * Existe porque `ActionGroup` no puede reescribir el estilo de cualquier hijo:
 * clonaba los `Button` del DS para volverlos `ghost`, pero `CallButton` y
 * `WhatsAppButton` no son `Button` —son sus propios `<a>` con el color del
 * canal— así que entraban al menú como bloques rosa y verde sólidos en vez de
 * opciones. Con este contexto cada componente decide cómo se ve adentro de un
 * menú, sin que `ActionGroup` tenga que conocerlos uno por uno.
 */
export const ActionMenuContext = createContext(false)

export function useInActionMenu(): boolean {
  return useContext(ActionMenuContext)
}
