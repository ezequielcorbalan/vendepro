'use client'

import { usePathname } from 'next/navigation'
import { BarChart3, List } from 'lucide-react'
import { Tabs } from '@/components/ui/Tabs'
import { Heading, Text } from '@/components/ui/Typography'

const TABS = [
  { href: '/reportes/performance', label: 'Performance', icon: <BarChart3 className="w-4 h-4" /> },
  { href: '/reportes/listado', label: 'Listado', icon: <List className="w-4 h-4" /> },
]

export default function ReportesLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const active = TABS.find(t => pathname === t.href || pathname.startsWith(t.href + '/'))

  return (
    <div className="space-y-4 sm:space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <Heading level={2}>Reportes</Heading>
          <Text size="sm" tone="muted">Performance y listado de reportes publicados</Text>
        </div>
      </div>

      <Tabs
        value={active?.href ?? ''}
        items={TABS.map(t => ({ value: t.href, href: t.href, label: t.label, icon: t.icon }))}
      />

      <div>{children}</div>
    </div>
  )
}
