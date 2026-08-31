'use client'

import { Children, Fragment, cloneElement, isValidElement, type ReactNode } from 'react'
import { MoreVertical } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Dropdown } from '@/components/ui/Dropdown'
import { cn } from '@/lib/utils'

/**
 * Grupo de acciones de un header, con desborde automático.
 *
 * Hasta `max` acciones van visibles. Con más, queda visible sólo la última
 * —que por convención es la principal— y el resto pasa al menú de tres puntos,
 * que va a la DERECHA de la acción visible (último elemento de la fila).
 *
 * El motivo: un header con cuatro botones del mismo peso no tiene acción
 * principal, y eso es peor que esconder tres detrás de un menú.
 *
 * Lo usa `PageHeader` y cualquier cabecera que no sea un PageHeader (por
 * ejemplo el detalle de contacto, que tiene avatar y datos propios).
 */
interface ActionGroupProps {
  children: ReactNode
  /** Cuántas acciones quedan visibles antes de desbordar al menú. Default 2. */
  max?: number
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
 * `Button` del DS se le cambia la variante; si es otra cosa se deja como está.
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

export function ActionGroup({ children, max = 2, className }: ActionGroupProps) {
  const items = flatten(children)
  if (items.length === 0) return null

  const overflows = items.length > max
  const visible = overflows ? items.slice(-1) : items
  const hidden = overflows ? items.slice(0, -1) : []

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
          {hidden.map(asMenuItem)}
        </Dropdown>
      )}
    </div>
  )
}
