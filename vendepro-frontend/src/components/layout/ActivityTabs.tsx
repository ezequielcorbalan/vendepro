'use client'

import { usePathname } from 'next/navigation'
import { Activity, TrendingUp } from 'lucide-react'
import { Tabs } from '@/components/ui/Tabs'

// Pestañas que unifican "Actividad" (registro/supervisión) y "Mi Performance"
// (analytics personal) bajo un solo item del menú, sin fusionar sus lógicas.
const TABS = [
  { href: '/actividades', label: 'Registro', icon: <Activity className="w-4 h-4" /> },
  { href: '/mi-performance', label: 'Mi Performance', icon: <TrendingUp className="w-4 h-4" /> },
]

export default function ActivityTabs() {
  const pathname = usePathname()
  const active = TABS.find(t => pathname === t.href || pathname.startsWith(t.href + '/'))

  return (
    <Tabs
      className="-mt-1"
      value={active?.href ?? ''}
      items={TABS.map(t => ({ value: t.href, href: t.href, label: t.label, icon: t.icon }))}
    />
  )
}
