'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Building2,
  Users,
  LogOut,
  Menu,
  X,
  FileBarChart,
  ClipboardList,
  Settings,
  DollarSign,
} from 'lucide-react'
import type { Profile } from '@/lib/types'

const agentLinks = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/propiedades', label: 'Propiedades', icon: Building2 },
  { href: '/tasaciones', label: 'Tasaciones', icon: ClipboardList },
  { href: '/vendidas', label: 'Vendidas', icon: DollarSign },
]

const adminLinks = [
  { href: '/admin/agentes', label: 'Agentes', icon: Users },
  { href: '/configuracion', label: 'Configuración', icon: Settings },
]

export default function MobileHeader({ profile }: { profile: Profile }) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const router = useRouter()

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }

  const links = profile.role === 'admin'
    ? [...agentLinks, ...adminLinks]
    : agentLinks

  return (
    <>
      {/* Fixed top bar */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 h-16 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <button onClick={() => setOpen(true)} className="p-2 -ml-2 rounded-lg hover:bg-gray-100">
            <Menu className="w-5 h-5 text-gray-700" />
          </button>
          <img src="/logo.png" alt="Marcela Genta" className="h-7" />
        </div>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-brand-pink/20 flex items-center justify-center text-brand-pink font-semibold text-sm">
            {profile.full_name.charAt(0).toUpperCase()}
          </div>
        </div>
      </header>

      {/* Overlay */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-50 bg-black/50" onClick={() => setOpen(false)}>
          <aside
            className="w-72 bg-white h-full shadow-xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <div>
                <img src="/logo.png" alt="Marcela Genta" className="h-8" />
                <p className="text-xs text-brand-gray mt-1 flex items-center gap-1">
                  <FileBarChart className="w-3 h-3" /> Reportes
                </p>
              </div>
              <button onClick={() => setOpen(false)} className="p-2 rounded-lg hover:bg-gray-100">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <nav className="flex-1 p-4 space-y-1">
              {links.map((link) => {
                const Icon = link.icon
                const isActive = pathname === link.href || pathname.startsWith(link.href + '/')
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      'flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-brand-pink/10 text-brand-pink'
                        : 'text-gray-600 hover:bg-gray-100'
                    )}
                  >
                    <Icon className="w-5 h-5" />
                    {link.label}
                  </Link>
                )
              })}
            </nav>

            <div className="p-4 border-t border-gray-100">
              <div className="flex items-center gap-3 px-3 py-2 mb-2">
                <div className="w-8 h-8 rounded-full bg-brand-pink/20 flex items-center justify-center text-brand-pink font-semibold text-sm">
                  {profile.full_name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{profile.full_name}</p>
                  <p className="text-xs text-brand-gray">{profile.role === 'admin' ? 'Administrador' : 'Agente'}</p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-600 hover:bg-gray-100 w-full"
              >
                <LogOut className="w-4 h-4" />
                Cerrar sesión
              </button>
            </div>
          </aside>
        </div>
      )}
    </>
  )
}
