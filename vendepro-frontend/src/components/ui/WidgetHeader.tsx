import type { ReactNode } from 'react'
import { Text } from '@/components/ui/Typography'
import { CardTitle } from '@/components/ui/Card'
import { IconMedallion, type IconMedallionSize } from '@/components/ui/IconMedallion'
import { cn } from '@/lib/utils'

/**
 * Header de widget — el hermano de `PageHeader` a escala de card.
 *
 * Es el patrón más repetido dentro de las cards de la app (~25 usos inline
 * antes de existir): medallón de gradiente con ícono, título, subtítulo o
 * contador, y una acción a la derecha. Estaba escrito a mano en cada widget con
 * drift real: medallones de w-7/w-9/w-10, radios `rounded-lg` vs
 * `rounded-control`, y hasta un gradiente distinto (`to-[#ff5e3a]` en vez del
 * naranja de marca).
 *
 * `PageHeader` va arriba de la PANTALLA; `WidgetHeader` va arriba del contenido
 * de una `Card`.
 *
 * Uso:
 *   <WidgetHeader icon={<FileCheck2 className="w-4 h-4" />} title="Documentación"
 *     subtitle={`${resueltos} de ${total} resueltos`} />
 *
 *   <WidgetHeader icon={<DollarSign className="w-4 h-4" />} title="Historial de precio"
 *     action={<Button variant="ghost" size="sm" icon={<Plus .../>}>Ajustar</Button>} />
 */
interface WidgetHeaderProps {
  /** Ícono de lucide; se envuelve en un `IconMedallion`. */
  icon?: ReactNode
  title: string
  subtitle?: ReactNode
  /** Contador/badge al lado del título (ej. cuántos items hay). */
  badge?: ReactNode
  /** Acción a la derecha — normalmente un `Button variant="ghost" size="sm"`. */
  action?: ReactNode
  /** Tamaño del medallón. `md` (w-9) por default. */
  size?: IconMedallionSize
  /** Tono del medallón. Gris por default: un ícono de encabezado NO se tiñe de
   *  marca (regla 3 de doc/ds-visual-rules.md). Se pasa un tono sólo cuando el
   *  ícono está ligado a algo con color propio (un canal, una integración) o
   *  cuando el widget comunica un estado. */
  tone?: string
  className?: string
}

export function WidgetHeader({
  icon,
  title,
  subtitle,
  badge,
  action,
  size = 'md',
  tone,
  className,
}: WidgetHeaderProps) {
  return (
    <div className={cn('flex items-start justify-between gap-3 mb-3', className)}>
      <div className="flex items-center gap-2 min-w-0">
        {icon && <IconMedallion size={size} tone={tone}>{icon}</IconMedallion>}
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {/* Reusa CardTitle: el DS ya decidió cómo se ve un título de card
                (14px semibold en h3) y lo usan 48 archivos. */}
            <CardTitle>{title}</CardTitle>
            {badge}
          </div>
          {subtitle && (
            <Text size="xs" tone="muted" className="mt-0.5">
              {subtitle}
            </Text>
          )}
        </div>
      </div>
      {action && <div className="flex items-center gap-2 shrink-0">{action}</div>}
    </div>
  )
}
