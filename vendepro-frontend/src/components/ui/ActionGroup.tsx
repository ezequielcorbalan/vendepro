'use client'

import { Children, Fragment, cloneElement, isValidElement, type ReactNode } from 'react'
import { MoreVertical } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Dropdown } from '@/components/ui/Dropdown'
import { ActionMenuContext } from '@/components/ui/action-menu'
import { cn } from '@/lib/utils'

/**
 * Grupo de acciones de un header, con desborde automático.
 *
 * Hasta `max` acciones van todas visibles. Con más, quedan visibles las
 * últimas `keep` —por convención las principales— y el resto pasa al menú de
 * tres puntos, que va a la DERECHA de las visibles (último de la fila).
 *
 * Son dos perillas porque son dos preguntas distintas: `max` es CUÁNDO aparece
 * el menú (con más de 2 acciones un header ya no tiene jerarquía) y `keep` es
 * CUÁNTAS sobreviven. El default (2 / 1) es el de todos los headers; una ficha
 * que necesita los canales de contacto a la vista sube `keep`.
 *
 * El motivo: un header con cuatro botones del mismo peso no tiene acción
 * principal, y eso es peor que esconder tres detrás de un menú.
 *
 * Lo usa `PageHeader` y cualquier cabecera que no sea un PageHeader (por
 * ejemplo el detalle de contacto, que tiene avatar y datos propios).
 */
interface ActionGroupProps {
  children: ReactNode
  /** Con más de estas acciones aparece el menú de tres puntos. Default 2. */
  max?: number
  /** Cuántas acciones quedan visibles cuando desborda. Default 1. */
  keep?: number
  className?: string
}

/** Aplana los children desenvolviendo fragments, para poder contarlos. */
function flatten(node: ReactNode): ReactNode[] {
  return Children.toArray(node).flatMap(child =>
    isValidElement(child) && child.type === Fragment
      ? flatten((child.props as { children?: ReactNode }).children)
      : [child],
  )
}

/**
 * Dentro del menú una acción se ve como item de menú, no como botón: si es un
 * `Button` del DS se le cambia la variante acá. Los que no son `Button`
 * —`CallButton`, `WhatsAppButton`— se adaptan solos leyendo
 * `ActionMenuContext`, que envuelve a todo el menú.
 */
function asMenuItem(node: ReactNode, key: number): ReactNode {
  if (isValidElement(node) && node.type === Button) {
    return cloneElement(node as React.ReactElement<Record<string, unknown>>, {
      key,
      variant: 'ghost',
      fullWidth: true,
      className: cn('justify-start gap-2.5', (node.props as { className?: string }).className),
    })
  }
  return <div key={key}>{node}</div>
}

export function ActionGroup({ children, max = 2, keep = 1, className }: ActionGroupProps) {
  const items = flatten(children)
  if (items.length === 0) return null

  const overflows = items.length > max
  const shown = Math.max(1, Math.min(keep, items.length))
  const visible = overflows ? items.slice(-shown) : items
  const hidden = overflows ? items.slice(0, -shown) : []

  return (
    <div className={cn('flex items-center gap-2 flex-wrap shrink-0', className)}>
      {visible}
      {hidden.length > 0 && (
        <Dropdown
          align="right"
          trigger={
            <Button variant="outline" size="icon" aria-label="Más acciones">
              <MoreVertical className="w-4 h-4" />
            </Button>
          }
        >
          <ActionMenuContext.Provider value={true}>
            {hidden.map(asMenuItem)}
          </ActionMenuContext.Provider>
        </Dropdown>
      )}
    </div>
  )
}
