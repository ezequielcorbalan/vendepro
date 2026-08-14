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
  /** Si se pasa, la tile es un link. */
  href?: string
  className?: string
}

export function StatTile({ icon, tone, label, value, caption, href, className }: StatTileProps) {
  const toneClasses = tone ? (TONE[tone] ?? tone) : ''
  const tinted = !icon && !!tone // sin ícono + con tone: tiñe toda la tile
  const base = cn(
    'rounded-card border border-gray-200 shadow-card p-3 sm:p-4 relative overflow-hidden',
    icon ? 'bg-white' : tinted ? toneClasses : 'bg-gray-50',
    className,
  )
  const valueClass = cn('text-xl sm:text-2xl font-bold', !tinted && 'text-ink')
  const mutedClass = cn('text-xs', !tinted && 'text-gray-500')

  const content = (
    <>
      {icon && (
        <div className={cn('w-9 h-9 rounded-control flex items-center justify-center mb-2', toneClasses)}>
          {icon}
        </div>
      )}
      <p className={valueClass}>{value}</p>
      <p className={cn(mutedClass, 'mt-0.5')}>{label}</p>
      {caption && <p className={cn(mutedClass, 'mt-1')}>{caption}</p>}
    </>
  )

  if (href) {
    return <a href={href} className={cn(base, 'block transition-shadow hover:shadow-md')}>{content}</a>
  }
  return <div className={base}>{content}</div>
}
