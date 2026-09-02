import type { ReactNode } from 'react'
import { Card } from '@/components/ui/Card'
import { Heading } from '@/components/ui/Typography'
import { ActionGroup } from '@/components/ui/ActionGroup'
import { cn } from '@/lib/utils'

/**
 * Encabezado de una pantalla de detalle (un contacto, un lead, una propiedad).
 * Es a la ficha lo que `PageHeader` es a un listado.
 *
 * Existe porque el detalle de contacto y el de lead habían quedado con dos
 * diseños distintos del mismo objeto: uno con avatar, división y una línea de
 * metadatos; el otro sin avatar, con los datos en un párrafo y tres botones del
 * mismo peso. No era una decisión, era que cada pantalla lo armó a mano.
 *
 * Anatomía, de arriba a abajo:
 *   avatar + título + badges          acciones (con desborde al menú)
 *   ─────────── división ───────────
 *   datos (usar `DetailMeta` para cada uno)
 *   footer (ej. notas)
 */
interface DetailHeaderProps {
  /** Avatar/medio a la izquierda del título. */
  avatar?: ReactNode
  title: string
  /** Al lado del título: etapa, tipo, link a la entidad relacionada. */
  badges?: ReactNode
  /** Fila propia debajo del título — típicamente las etiquetas editables. */
  tags?: ReactNode
  /** Datos del registro. Usar `DetailMeta` por ítem: van todos en una fila que
   *  envuelve, con el mismo tratamiento, para que no parezcan cajas sueltas. */
  meta?: ReactNode
  /** Acciones a la derecha. Pasan por `ActionGroup`, así que desbordan al menú
   *  de tres puntos. */
  actions?: ReactNode
  /** Cuántas acciones quedan visibles cuando desbordan al menú. Default 1 (el
   *  del `ActionGroup`). Subilo cuando la pantalla necesita los canales de
   *  contacto siempre a la vista — `rules/ux-ui.md`: llamar y WhatsApp siempre
   *  accesibles. */
  visibleActions?: number
  /** Bloque libre al pie, ancho completo (ej. notas). */
  footer?: ReactNode
  className?: string
}

export function DetailHeader({
  avatar,
  title,
  badges,
  tags,
  meta,
  actions,
  visibleActions,
  footer,
  className,
}: DetailHeaderProps) {
  return (
    <Card padded={false} className={cn('p-5 sm:p-6', className)}>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          {avatar}
          <div className="min-w-0 space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <Heading level={2} as="h1">{title}</Heading>
              {badges}
            </div>
            {tags}
          </div>
        </div>
        {actions && <ActionGroup keep={visibleActions}>{actions}</ActionGroup>}
      </div>

      {meta && (
        <div className="mt-5 pt-5 border-t border-gray-100 flex flex-wrap items-center gap-x-6 gap-y-2.5">
          {meta}
        </div>
      )}

      {footer && <div className="mt-4">{footer}</div>}
    </Card>
  )
}

/**
 * Un dato del encabezado: ícono gris + texto. Todos los datos se tratan igual
 * para que la fila lea como una línea de metadatos y no como cajas de distinto
 * peso — que era lo que hacía que los datos parecieran flotar.
 */
export function DetailMeta({ icon, children }: { icon?: ReactNode; children: ReactNode }) {
  return (
    <span className="flex items-center gap-2 text-sm text-gray-600 min-w-0">
      {icon && <span className="text-gray-400 shrink-0">{icon}</span>}
      <span className="truncate">{children}</span>
    </span>
  )
}
