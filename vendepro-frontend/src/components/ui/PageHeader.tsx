import type { ReactNode } from 'react'
import { Heading, Text } from '@/components/ui/Typography'
import { Card } from '@/components/ui/Card'
import { ActionGroup } from '@/components/ui/ActionGroup'
import { cn } from '@/lib/utils'

/**
 * Header estándar de página del design system. Unifica título, subtítulo y la
 * zona de acciones en todas las pantallas. Usar SIEMPRE arriba de cada pantalla
 * en vez de armar el <h1>/acciones a mano.
 *
 * Superficie blanca (la misma `Card` del DS), para que el header se despegue
 * del fondo de página.
 *
 * Las acciones desbordan solas: hasta 2 van visibles, con más queda la última
 * —la principal por convención— y el resto va al menú de tres puntos. La
 * lógica vive en `ActionGroup`.
 */
interface PageHeaderProps {
  title: string
  subtitle?: string
  /** Botones/acciones a la derecha. Con más de 2, las que sobran van al menú. */
  actions?: ReactNode
  className?: string
}

export function PageHeader({ title, subtitle, actions, className }: PageHeaderProps) {
  return (
    <Card className={cn('flex items-center justify-between gap-3 flex-wrap', className)}>
      <div className="min-w-0">
        <Heading level={2} as="h1">{title}</Heading>
        {subtitle && <Text tone="muted" className="mt-0.5">{subtitle}</Text>}
      </div>
      {actions && <ActionGroup>{actions}</ActionGroup>}
    </Card>
  )
}
