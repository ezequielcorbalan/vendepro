'use client'

import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Botón del design system de VendéPro.
 *
 * Fuente única de estilos: editá los mapas VARIANTS / SIZES de acá y el cambio
 * se refleja en toda la app. Los colores salen de los tokens de marca
 * (globals.css → @theme): brand-pink / brand-orange y el gradiente de marca.
 */
export type ButtonVariant = 'primary' | 'outline' | 'ghost' | 'neutral' | 'success' | 'danger'
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon'

const VARIANTS: Record<ButtonVariant, string> = {
  // CTA principal — color primario sólido (hoy brand-pink, vía token --color-primary).
  primary: 'bg-primary text-white hover:bg-primary-hover',
  // Contorno — acción secundaria (gris: stroke claro + texto gris oscuro).
  outline: 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50',
  // Fantasma — acción terciaria / cancelar.
  ghost: 'text-gray-700 hover:bg-gray-100',
  // Neutra oscura — acción con peso que no es la primaria de la pantalla, ni
  // secundaria gris. Se agregó con datos: 5 botones gray-800/slate-900 inline en
  // 5 módulos (crear lead desde contacto, baja de suscripción, subir imagen,
  // guardar campaña, guardar tasación).
  neutral: 'bg-gray-800 text-white hover:bg-gray-900',
  // Confirmatoria/constructiva — crear, publicar, aprobar. Se agregó con datos:
  // 4 botones verdes inline en 3 archivos (crear propiedad, publicar landing).
  success: 'bg-success text-white hover:opacity-90',
  // Destructiva.
  danger: 'bg-danger text-white hover:opacity-90',
}

// Radio y padding unificados en toda la escala (resuelve el drift rounded-control/full
// y py-2/2.5/3 que había en el código inline).
const SIZES: Record<ButtonSize, string> = {
  sm: 'text-xs px-3 py-1.5 gap-1.5 rounded-control',
  md: 'text-sm px-4 py-2 gap-2 rounded-control',
  lg: 'text-sm px-5 py-2.5 gap-2 rounded-control',
  // Sólo ícono (sin texto): cuadrado, sin gap. Ej. <Button variant="ghost" size="icon" aria-label="Eliminar"><Trash2 .../></Button>
  icon: 'p-2 rounded-control',
}

interface ButtonBaseProps {
  variant?: ButtonVariant
  size?: ButtonSize
  /** Muestra un spinner y deshabilita el botón. */
  loading?: boolean
  /** Ícono a la izquierda del texto (un ícono de lucide-react). */
  icon?: ReactNode
  /** Ocupa todo el ancho disponible. */
  fullWidth?: boolean
  className?: string
  children?: ReactNode
}

/**
 * Dos elementos, mismo estilo. Con `href` el botón es un `<Link>`; sin `href`,
 * un `<button>`. Había 22 `<Link>` en 14 archivos replicando a mano el relleno,
 * el padding y el radio de este componente, y perdiendo la variante en el
 * camino. Un `<a>` es lo correcto cuando la acción es navegar: se puede abrir en
 * pestaña nueva, copiar el link y prefetchear.
 */
type ButtonProps = ButtonBaseProps &
  (
    | ({ href?: undefined } & Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof ButtonBaseProps>)
    | ({ href: string } & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof ButtonBaseProps | 'href'>)
  )

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  fullWidth = false,
  className,
  children,
  ...rest
}: ButtonProps) {
  const classes = cn(
    'inline-flex items-center justify-center font-medium transition-colors',
    'disabled:opacity-50 disabled:cursor-not-allowed',
    VARIANTS[variant],
    SIZES[size],
    fullWidth && 'w-full',
    className,
  )
  const inner = (
    <>
      {loading ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : icon}
      {children}
    </>
  )

  if (rest.href !== undefined) {
    const { href, ...anchorProps } = rest
    // Un link deshabilitado no existe en HTML: se renderiza como span inerte
    // para no ofrecer una navegación que no va a pasar.
    if (anchorProps['aria-disabled'] === true || loading) {
      return (
        <span className={cn(classes, 'opacity-50 cursor-not-allowed')} aria-disabled>
          {inner}
        </span>
      )
    }
    return (
      <Link href={href} className={classes} {...anchorProps}>
        {inner}
      </Link>
    )
  }

  const {
    // type='button' por default: si no, dentro de un <form> submitearía. Pasá
    // type="submit" explícito cuando el botón deba enviar el formulario.
    type = 'button',
    disabled,
    ...buttonProps
  } = rest

  return (
    <button type={type} className={classes} disabled={disabled || loading} {...buttonProps}>
      {inner}
    </button>
  )
}
