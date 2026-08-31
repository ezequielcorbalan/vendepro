'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'

/**
 * Avatar del design system. Con foto usa object-cover; sin foto, iniciales en
 * gris — el mismo neutro que el tono `neutral` de IconMedallion.
 *
 * El fallback no va en primary a propósito: un avatar es identidad, no estado, y
 * en una lista de contactos una columna de círculos rosas compite con las
 * señales que sí significan algo (etapa, urgencia, acciones).
 */
export type AvatarSize = 'sm' | 'md' | 'lg'

const SIZES: Record<AvatarSize, string> = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base',
}

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('')
}

interface AvatarProps {
  name: string
  src?: string | null
  size?: AvatarSize
  className?: string
}

export function Avatar({ name, src, size = 'md', className }: AvatarProps) {
  const [failed, setFailed] = useState(false)
  if (src && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name}
        onError={() => setFailed(true)}
        className={cn('rounded-full object-cover shrink-0', SIZES[size], className)}
      />
    )
  }
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-full shrink-0 font-semibold',
        'bg-gray-100 text-gray-600',
        SIZES[size],
        className,
      )}
      aria-label={name}
    >
      {initials(name)}
    </span>
  )
}
