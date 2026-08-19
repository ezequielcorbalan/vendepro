'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Activity, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'

// Pestañas que unifican "Actividad" (registro/supervisión) y "Mi Performance"
// (analytics personal) bajo un solo item del menú, sin fusionar sus lógicas.
// ds-todo: candidato a variante "Tabs con href" — Tabs del DS es controlado
// (value + onChange) y acá cada pestaña es una ruta, así que el estilo se
// replica a mano contra el de ui/Tabs.
const TABS = [
  { href: '/actividades', label: 'Registro', icon: Activity },
  { href: '/mi-performance', label: 'Mi Performance', icon: TrendingUp },
]

export default function ActivityTabs() {
  const pathname = usePathname()
  return (
    <div className="flex gap-1 border-b border-gray-200 -mt-1" role="tablist" aria-label="Actividad">
      {TABS.map((t) => {
        const active = pathname === t.href || pathname.startsWith(t.href + '/')
        const Icon = t.icon
        return (
          <Link
            key={t.href}
            href={t.href}
            role="tab"
            aria-selected={active}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
              active
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:text-ink hover:border-gray-300'
            )}
          >
            <Icon className="w-4 h-4" aria-hidden="true" />
            {t.label}
          </Link>
        )
      })}
    </div>
  )
}
