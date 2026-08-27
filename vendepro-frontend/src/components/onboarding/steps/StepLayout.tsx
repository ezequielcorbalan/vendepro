import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Heading, Text } from '@/components/ui/Typography'

/**
 * Esqueleto compartido de los pasos del onboarding: ícono, título, descripción,
 * una zona libre (chips, KPIs, pipeline) y la lista de puntos.
 *
 * ds-todo: candidato a componente del DS "StepHero" — este patrón (ícono en caja
 * + título + descripción centrados) se repite en los 8 pasos y se parece al
 * encabezado de EmptyState, pero con jerarquía de página.
 */
interface StepLayoutProps {
  icon: ReactNode
  /** Clases de la caja del ícono. Por defecto, primario translúcido. */
  iconClassName?: string
  /** Caja redonda y grande, para los pasos de apertura y cierre. */
  hero?: boolean
  title: ReactNode
  description: ReactNode
  /** Contenido entre la descripción y la lista (chips, pipeline, KPIs). */
  children?: ReactNode
  /** Puntos del paso: ícono + texto. */
  points: { icon: ReactNode; text: string }[]
  footer?: ReactNode
}

export function StepLayout({
  icon,
  iconClassName,
  hero = false,
  title,
  description,
  children,
  points,
  footer,
}: StepLayoutProps) {
  return (
    <div className="flex flex-col items-center text-center px-4 py-6 gap-5">
      <div
        className={cn(
          'flex items-center justify-center shrink-0',
          hero
            ? 'w-24 h-24 rounded-full bg-gradient-to-br from-brand-pink to-brand-orange text-white'
            : 'w-16 h-16 rounded-control bg-primary/10 text-primary',
          iconClassName,
        )}
      >
        {icon}
      </div>

      <div className="space-y-1">
        <Heading level={2}>{title}</Heading>
        <Text tone="muted" className="max-w-sm">{description}</Text>
      </div>

      {children}

      {points.length > 0 && (
        <div className="w-full max-w-sm space-y-3 text-left">
          {points.map(p => (
            <div key={p.text} className="flex items-start gap-3 p-3 bg-gray-50 rounded-card">
              <span className="text-gray-500 mt-0.5 shrink-0" aria-hidden="true">{p.icon}</span>
              <Text size="sm" className="text-gray-700">{p.text}</Text>
            </div>
          ))}
        </div>
      )}

      {footer}
    </div>
  )
}
