import { cn } from '@/lib/utils'

/**
 * Avatar del design system. Con foto usa object-cover; sin foto, iniciales
 * sobre el color primario translúcido (primary/20).
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
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name}
        className={cn('rounded-full object-cover shrink-0', SIZES[size], className)}
      />
    )
  }
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-full shrink-0 font-semibold',
        'bg-primary/20 text-primary',
        SIZES[size],
        className,
      )}
      aria-label={name}
    >
      {initials(name)}
    </span>
  )
}
