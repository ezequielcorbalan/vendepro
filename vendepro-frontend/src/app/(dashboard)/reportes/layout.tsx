'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BarChart3, List } from 'lucide-react'
import { cn } from '@/lib/utils'

const TABS = [
  { href: '/reportes/performance', label: 'Performance', icon: BarChart3 },
  { href: '/reportes/listado', label: 'Listado', icon: List },
] as const

export default function ReportesLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="space-y-4 sm:space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-800">Reportes</h1>
          <p className="text-gray-500 text-sm">Performance y listado de reportes publicados</p>
        </div>
      </div>

      <div className="flex gap-1 border-b border-gray-200">
        {TABS.map(tab => {
          const Icon = tab.icon
          const isActive = pathname === tab.href || pathname.startsWith(tab.href + '/')
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
                isActive
                  ? 'border-[#ff007c] text-[#ff007c]'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
              )}
            >
              <Icon className="w-4 h-4" aria-hidden="true" />
              {tab.label}
            </Link>
          )
        })}
      </div>

      <div>{children}</div>
    </div>
  )
}
