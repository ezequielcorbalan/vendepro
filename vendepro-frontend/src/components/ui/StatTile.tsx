import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * Tile de estadística: valor grande + label, con dos modos según haya `icon`:
 * - Con `icon`: tile blanca; el `tone` sólo colorea la caja del ícono (KPI del
 *   dashboard). Value en ink, label en gris.
 * - Sin `icon`: el `tone` tiñe TODA la tile (bg + texto) — para resultados con
 *   significado semántico (ej. margen positivo/negativo).
 * - Sin `icon` y sin `tone`: tile neutra gris, value en ink (ej. un total sin
 *   connotación positiva/negativa).
 *
 * `tone` acepta los tokens semánticos (primary|success|danger|info) o una
 * clase Tailwind cruda para categorías puramente decorativas sin significado
 * de estado (ej. 'bg-cyan-50 text-cyan-600') — mismo criterio que StatusBadge.
 *
 * Para el KPI destacado (semáforo de performance): `emphasis` tiñe el borde (1px)
 * y el fondo con el `tone`, y `badge` agrega un slot debajo del label. Antes
 * eso era una Card armada a mano porque StatTile no soportaba ninguna de las dos.
 */
const TONE: Record<string, string> = {
  primary: 'bg-primary/10 text-primary',
  success: 'bg-success/10 text-success',
  danger: 'bg-danger/10 text-danger',
  info: 'bg-info/10 text-info',
}

interface StatTileProps {
  icon?: ReactNode
  tone?: string
  label: string
  value: ReactNode
  /** Línea chica opcional debajo del valor (ej. "12% ROI"). */
  caption?: string
  /** Slot al pie de la tile — un badge de estado (ej. HealthBadge del semáforo). */
  badge?: ReactNode
  /** KPI destacado: borde de 1px y fondo teñidos con el `tone`, sin perder el ícono. */
  emphasis?: boolean
  /** Si se pasa, la tile es un link. */
  href?: string
  className?: string
}

export function StatTile({
  icon,
  tone,
  label,
  value,
  caption,
  badge,
  emphasis = false,
  href,
  className,
}: StatTileProps) {
  const toneClasses = tone ? (TONE[tone] ?? tone) : ''
  // sin ícono + con tone: tiñe toda la tile. Con `emphasis` también tiñe, pero
  // conserva el ícono en su propia caja blanca.
  const tinted = (!icon && !!tone) || (emphasis && !!tone)
  const base = cn(
    'rounded-card shadow-card p-3 sm:p-4 relative overflow-hidden',
    emphasis ? 'border' : 'border border-gray-200',
    emphasis && tone ? toneClasses : icon ? 'bg-white' : tinted ? toneClasses : 'bg-gray-50',
    className,
  )
  const valueClass = cn('text-xl sm:text-2xl font-bold', !tinted && 'text-ink')
  const mutedClass = cn('text-xs', !tinted && 'text-gray-500')

  const content = (
    <>
      {icon && (
        <div
          className={cn(
            'w-9 h-9 rounded-control flex items-center justify-center mb-2',
            // Con emphasis el fondo de la tile ya está teñido: la caja del ícono
            // va en blanco translúcido para que el ícono siga legible.
            emphasis ? 'bg-white/70 border shadow-card' : toneClasses,
          )}
        >
          {icon}
        </div>
      )}
      <p className={valueClass}>{value}</p>
      <p className={cn(mutedClass, 'mt-0.5')}>{label}</p>
      {caption && <p className={cn(mutedClass, 'mt-1')}>{caption}</p>}
      {badge && <div className="mt-1">{badge}</div>}
    </>
  )

  if (href) {
    return <a href={href} className={cn(base, 'block transition-shadow hover:shadow-md')}>{content}</a>
  }
  return <div className={base}>{content}</div>
}
