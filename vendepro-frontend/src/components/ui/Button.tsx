'use client'

import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Botón del design system de VendéPro.
 *
 * Fuente única de estilos: editá los mapas VARIANTS / SIZES de acá y el cambio
 * se refleja en toda la app. Los colores salen de los tokens de marca
 * (globals.css → @theme): brand-pink / brand-orange y el gradiente de marca.
 */
export type ButtonVariant = 'primary' | 'outline' | 'ghost' | 'danger'
export type ButtonSize = 'sm' | 'md' | 'lg'

const VARIANTS: Record<ButtonVariant, string> = {
  // CTA principal — color primario sólido (hoy brand-pink, vía token --color-primary).
  primary: 'bg-primary text-white hover:bg-primary-hover',
  // Contorno — acción secundaria.
  outline: 'bg-white border border-primary text-primary hover:bg-primary/5',
  // Fantasma — acción terciaria / cancelar.
  ghost: 'text-gray-700 hover:bg-gray-100',
  // Destructiva.
  danger: 'bg-danger text-white hover:opacity-90',
}

// Radio y padding unificados en toda la escala (resuelve el drift rounded-control/full
// y py-2/2.5/3 que había en el código inline).
const SIZES: Record<ButtonSize, string> = {
  sm: 'text-xs px-3 py-1.5 gap-1.5 rounded-control',
  md: 'text-sm px-4 py-2 gap-2 rounded-control',
  lg: 'text-sm px-5 py-2.5 gap-2 rounded-control',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  /** Muestra un spinner y deshabilita el botón. */
  loading?: boolean
  /** Ícono a la izquierda del texto (un ícono de lucide-react). */
  icon?: ReactNode
  /** Ocupa todo el ancho disponible. */
  fullWidth?: boolean
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  fullWidth = false,
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center font-medium transition-colors',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        VARIANTS[variant],
        SIZES[size],
        fullWidth && 'w-full',
        className,
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  )
}
