import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * Medallón de ícono — caja con tinte de color y el ícono del mismo color.
 * Es el patrón más repetido de la app (24 usos inline antes de existir): título
 * de pantalla, header de card, avatar de sección, pantallas de onboarding.
 *
 * Unifica el drift que había: tamaños w-7/8/9/10/12/24, radios mezclados
 * (`rounded-lg` suelto vs `rounded-control`) y sombras distintas. El gradiente
 *
 * Uso:
 *   <IconMedallion size="lg"><Home className="w-5 h-5 text-white" /></IconMedallion>
 *   <IconMedallion shape="circle" size="hero" elevated><Check .../></IconMedallion>
 */
export type IconMedallionSize = 'sm' | 'md' | 'lg' | 'xl' | 'hero'
export type IconMedallionShape = 'control' | 'circle'

// Escala en base-4. Los usos inline que caían en w-7 suben a `sm` (w-8): la
// consistencia gana sobre el píxel exacto.
const SIZES: Record<IconMedallionSize, string> = {
  sm: 'w-8 h-8',
  md: 'w-9 h-9',
  lg: 'w-10 h-10',
  xl: 'w-12 h-12',
  // Pantallas de bienvenida/éxito (onboarding, estados vacíos grandes).
  hero: 'w-24 h-24',
}

// Mismos nombres que Badge/StatTile: un solo vocabulario de tonos en el DS.
const TONES: Record<string, string> = {
  primary: 'bg-primary/10 text-primary',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  danger: 'bg-danger/10 text-danger',
  info: 'bg-info/10 text-info',
  neutral: 'bg-gray-100 text-gray-600',
}

const SHAPES: Record<IconMedallionShape, string> = {
  control: 'rounded-control',
  circle: 'rounded-full',
}

interface IconMedallionProps {
  children: ReactNode
  size?: IconMedallionSize
  shape?: IconMedallionShape
  /** Tono semántico (`primary` por default) o un par de clases crudas. */
  tone?: string
  /** Suma `shadow-card`. */
  elevated?: boolean
  className?: string
}

export function IconMedallion({
  children,
  size = 'md',
  shape = 'control',
  tone = 'primary',
  elevated = false,
  className,
}: IconMedallionProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-center shrink-0',
        TONES[tone] ?? tone,
        SIZES[size],
        SHAPES[shape],
        elevated && 'shadow-card',
        className,
      )}
      aria-hidden="true"
    >
      {children}
    </div>
  )
}
