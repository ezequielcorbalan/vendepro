import type { ReactNode } from 'react'
import { Card } from './Card'
import { Heading, Text } from './Typography'
import { cn } from '@/lib/utils'

/**
 * Un paso de un flujo VERTICAL: todos los pasos se ven a la vez, apilados, cada
 * uno en su `Card` con su número. No es `StepIndicator`, que es la barrita de
 * progreso de un wizard donde se ve UN paso por vez y los demás están ocultos.
 *
 * Dos pantallas lo tenían: el editor de automatizaciones (con este componente,
 * pero local a su carpeta) y la prueba de token de `/configuracion/api` (a mano,
 * con un `<span>` redondo repetido tres veces). Las dos versiones no coincidían:
 * la de automatizaciones usaba un círculo gris de 28px y la de API uno rosa de
 * 20px. Gana el gris, porque `primary` está reservado para acciones y estados
 * (regla 15 de doc/ds-visual-rules.md) y el número de un paso no es ninguna de
 * las dos: es un ordinal, y el color lo tiene que poner el título.
 *
 * El número va `aria-hidden`: para un lector de pantalla "1" solo no dice nada
 * y el orden ya lo da el DOM. Lo que se lee es el título.
 *
 * `level` existe porque el nivel correcto depende de qué hay arriba: en
 * automatizaciones los pasos son la primera jerarquía de la pantalla (3), y en
 * la prueba de token cuelgan de un título de sección (4). Saltarse un nivel
 * rompe la navegación por encabezados.
 */
interface StepCardProps {
  /** El ordinal que se dibuja en el círculo. */
  step: number
  title: string
  /** Ícono al lado del título. Opcional: la prueba de token no los usa. */
  icon?: ReactNode
  subtitle?: ReactNode
  /** Nivel del encabezado del paso. 3 si los pasos son la primera jerarquía. */
  level?: 3 | 4
  /** Acción a la derecha del título (por ejemplo "Copiar comando"). */
  action?: ReactNode
  children: ReactNode
  className?: string
}

export function StepCard({
  step, title, icon, subtitle, level = 3, action, children, className,
}: StepCardProps) {
  return (
    <Card className={className}>
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="w-7 h-7 rounded-full bg-gray-100 text-gray-700 grid place-items-center text-sm font-semibold shrink-0"
        >
          {step}
        </span>
        <div className="min-w-0 flex-1">
          <div className={cn('flex items-start justify-between gap-2', Boolean(action) && 'flex-wrap')}>
            <Heading level={level} className="flex items-center gap-2">{icon} {title}</Heading>
            {action}
          </div>
          {subtitle && <Text size="sm" tone="muted" className="mt-0.5 block">{subtitle}</Text>}
          <div className="mt-4">{children}</div>
        </div>
      </div>
    </Card>
  )
}
