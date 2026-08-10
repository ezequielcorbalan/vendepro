import type { ReactNode, ElementType } from 'react'
import { cn } from '@/lib/utils'

/**
 * Tipografía del design system. La escala (tamaños + pesos) vive acá: es la
 * fuente única de la jerarquía de texto. Cambiás un mapa y se actualiza toda la
 * app. La familia (Poppins) se define global en globals.css (body).
 */

// ── Pesos (compartidos por Heading y Text) ───────────────────
export type FontWeight = 'normal' | 'medium' | 'semibold' | 'bold' | 'extrabold'
const WEIGHT: Record<FontWeight, string> = {
  normal: 'font-normal',
  medium: 'font-medium',
  semibold: 'font-semibold',
  bold: 'font-bold',
  extrabold: 'font-extrabold',
}

// ── Heading ──────────────────────────────────────────────────
export type HeadingLevel = 1 | 2 | 3 | 4

// Tamaño por nivel (sin peso — el peso se aplica aparte para poder overridearlo).
const HEADING_SIZE: Record<HeadingLevel, string> = {
  1: 'text-3xl tracking-tight', // 30 · título de página
  2: 'text-2xl tracking-tight', // 24 · título de sección
  3: 'text-xl',                 // 20 · encabezado de card
  4: 'text-base',               // 16 · subtítulo
}
// Peso por defecto de cada nivel (overridable con la prop `weight`).
const HEADING_WEIGHT: Record<HeadingLevel, FontWeight> = {
  1: 'extrabold',
  2: 'semibold',  // default más liviano (antes bold) — preferencia de marca
  3: 'semibold',
  4: 'semibold',
}

interface HeadingProps {
  /** 1–4. Define el tag (h1..h4), el tamaño y el peso por defecto. */
  level?: HeadingLevel
  /** Override del peso (ej. bajar un título a semibold sin cambiar su tamaño). */
  weight?: FontWeight
  /** Cambiá el tag sin cambiar el estilo (ej. h2 visual dentro de un h1 semántico). */
  as?: ElementType
  className?: string
  children: ReactNode
}

export function Heading({ level = 2, weight, as, className, children }: HeadingProps) {
  const Tag = (as ?? (`h${level}` as ElementType)) as ElementType
  return (
    <Tag className={cn('text-ink text-balance', HEADING_SIZE[level], WEIGHT[weight ?? HEADING_WEIGHT[level]], className)}>
      {children}
    </Tag>
  )
}

// ── Text ─────────────────────────────────────────────────────
export type TextSize = 'xs' | 'sm' | 'base' | 'lg'
export type TextWeight = 'normal' | 'medium' | 'semibold' | 'bold'
export type TextTone = 'default' | 'muted' | 'primary' | 'danger' | 'success'

const SIZE: Record<TextSize, string> = {
  xs: 'text-xs',   // 12 · metadatos
  sm: 'text-sm',   // 14 · cuerpo de trabajo (default)
  base: 'text-base', // 16
  lg: 'text-lg',   // 18
}
const TONE: Record<TextTone, string> = {
  default: 'text-ink',
  muted: 'text-gray-500',
  primary: 'text-primary',
  danger: 'text-danger',
  success: 'text-success',
}

interface TextProps {
  size?: TextSize
  weight?: TextWeight
  tone?: TextTone
  /** Tag a renderizar (p por defecto). */
  as?: ElementType
  className?: string
  children: ReactNode
}

export function Text({ size = 'sm', weight = 'normal', tone = 'default', as, className, children }: TextProps) {
  const Tag = (as ?? 'p') as ElementType
  return <Tag className={cn(SIZE[size], WEIGHT[weight], TONE[tone], className)}>{children}</Tag>
}
