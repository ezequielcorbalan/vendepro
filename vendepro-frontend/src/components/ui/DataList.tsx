import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * DataList — la lista que reemplaza a una Table en mobile.
 *
 * Las reglas de responsive piden cards en vez de tabla en los módulos de campo
 * (leads, contactos, actividad, calendario, tasaciones), así que cada listado
 * termina armando su propia versión apilada. Esto unifica el marco: divisores,
 * padding y la grilla de cada fila (media · contenido · acción).
 *
 * Se usa por composición, como Card:
 *
 *   <DataList>
 *     {items.map(c => (
 *       <DataListRow key={c.id} media={<Avatar name={c.name} />} title={…} action={…}>
 *         …metadata libre…
 *       </DataListRow>
 *     ))}
 *   </DataList>
 *
 * El contenido de cada fila queda del lado de la pantalla: lo que se comparte
 * es el esqueleto, no qué datos se muestran.
 */
export function DataList({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('divide-y divide-gray-100', className)}>{children}</div>
}

interface DataListRowProps {
  /** Avatar, ícono o miniatura a la izquierda. */
  media?: ReactNode
  /** Nombre o título de la fila (suele ser un Link). */
  title: ReactNode
  /** Badge al lado del título (estado, tipo). */
  badge?: ReactNode
  /** Acción al final de la fila (borrar, abrir menú). */
  action?: ReactNode
  /** Metadata: teléfono, dirección, chips. Va debajo del título. */
  children?: ReactNode
  className?: string
}

export function DataListRow({ media, title, badge, action, children, className }: DataListRowProps) {
  return (
    <div className={cn('p-4 flex items-start gap-3', className)}>
      {media && <div className="shrink-0">{media}</div>}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          {title}
          {badge}
        </div>
        {children}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}
