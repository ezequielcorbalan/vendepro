import type { ReactNode } from 'react'
import { Heading, Text } from '@/components/ui/Typography'
import { cn } from '@/lib/utils'

/**
 * Header estándar de página del design system. Unifica título, subtítulo y la
 * zona de acciones en todas las pantallas. Usar SIEMPRE arriba de cada pantalla
 * en vez de armar el <h1>/acciones a mano.
 */
interface PageHeaderProps {
  title: string
  subtitle?: string
  /** Botones/acciones a la derecha. */
  actions?: ReactNode
  className?: string
}

export function PageHeader({ title, subtitle, actions, className }: PageHeaderProps) {
  return (
    <div className={cn('flex items-center justify-between gap-3 flex-wrap', className)}>
      <div className="min-w-0">
        <Heading level={2} as="h1">{title}</Heading>
        {subtitle && <Text tone="muted" className="mt-0.5">{subtitle}</Text>}
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap shrink-0">{actions}</div>}
    </div>
  )
}
