import type { ReactNode } from 'react'
import { IconMedallion } from '@/components/ui/IconMedallion'
import { Heading, Text } from '@/components/ui/Typography'

/**
 * Molde de un paso del onboarding. Los 8 pasos repetían el mismo header a mano
 * (caja de ícono + h2 + subtítulo) y habían quedado inconsistentes: 5 usaban un
 * ícono de lucide sobre una caja de color y 3 un emoji sobre una caja con
 * gradiente. Acá el header es uno solo.
 *
 * Los íconos son de lucide, los mismos que usa la app adentro — no emojis.
 */
export function StepLayout({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: ReactNode
  title: string
  subtitle: string
  children?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center text-center px-4 py-5 gap-4">
      <IconMedallion size="hero" shape="circle" elevated className="w-16 h-16">
        {icon}
      </IconMedallion>
      <div className="space-y-1">
        <Heading level={2}>{title}</Heading>
        <Text size="sm" tone="muted" className="max-w-sm">{subtitle}</Text>
      </div>
      {children}
    </div>
  )
}

/**
 * Lista de puntos de un paso. Antes cada paso la armaba a mano con un emoji
 * como viñeta; ahora recibe íconos de lucide.
 */
export function StepBullets({ items }: { items: Array<[ReactNode, string]> }) {
  return (
    <div className="w-full max-w-sm space-y-3 text-left">
      {items.map(([icon, text]) => (
        <div key={text} className="flex items-start gap-3 p-3 bg-gray-50 rounded-card">
          <span className="text-gray-400 shrink-0 mt-0.5">{icon}</span>
          <Text size="sm" className="text-gray-700">{text}</Text>
        </div>
      ))}
    </div>
  )
}
