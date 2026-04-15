'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Settings, LogOut, FileBarChart } from 'lucide-react'
import { cn } from '@/lib/utils'
import GlobalSearch from './GlobalSearch'
import NotificationBell from './NotificationBell'
import { menuSections, adminSection } from '@/lib/nav-config'
import { apiFetch, clearToken } from '@/lib/api'
import type { Profile } from '@/lib/types'

export default function Sidebar({ profile }: { profile: Profile }) {
  const pathname = usePathname()
  const router = useRouter()

  async function handleLogout() {
    try {
      await apiFetch('auth', '/logout', { method: 'POST' })
    } catch {}
    clearToken()
    document.cookie = 'vendepro_token=; Max-Age=0; path=/'
    router.push('/login')
    router.refresh()
  }

  const sections = (profile.role === 'admin' || profile.role === 'owner')
    ? [...menuSections, adminSection]
    : menuSections

  return (
    <aside className="w-64 bg-white border-r border-gray-200 flex flex-col h-screen fixed left-0 top-0">
      <div className="p-6 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <img src="/logo.png" alt="VendéPro" className="h-10" />
          <NotificationBell />
        </div>
        <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
          <FileBarChart className="w-3 h-3" aria-hidden="true" /> Gestión inmobiliaria
        </p>
      </div>

      <div className="px-4 pt-3 pb-1">
        <GlobalSearch />
      </div>

      <nav className="flex-1 p-4 space-y-4 overflow-y-auto" aria-label="Navegación principal">
        {sections.map((section) => (
          <div key={section.title}>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-3 mb-1">
              {section.title}
            </p>
            <div className="space-y-0.5">
              {section.links.map((link) => {
                const Icon = link.icon
                const isActive = pathname === link.href || (!link.exact && pathname.startsWith(link.href + '/'))
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    aria-current={isActive ? 'page' : undefined}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-[#ff007c]/10 text-[#ff007c]'
                        : 'text-gray-600 hover:bg-gray-100'
                    )}
                  >
                    <Icon className="w-5 h-5" aria-hidden="true" />
                    {link.label}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="p-4 border-t border-gray-100 space-y-1">
        <Link href="/perfil" className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors">
          <div className="w-8 h-8 rounded-full bg-[#ff007c]/20 flex items-center justify-center text-[#ff007c] font-semibold text-sm" aria-hidden="true">
            {profile.full_name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-800 truncate">{profile.full_name}</p>
            <p className="text-xs text-gray-500 truncate">{profile.role === 'admin' ? 'Administrador' : 'Agente'}</p>
          </div>
        </Link>
        <Link
          href="/configuracion"
          aria-current={pathname.startsWith('/configuracion') || pathname.startsWith('/perfil') ? 'page' : undefined}
          className={cn(
            'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
            pathname.startsWith('/configuracion') || pathname.startsWith('/perfil')
              ? 'bg-[#ff007c]/10 text-[#ff007c]'
              : 'text-gray-600 hover:bg-gray-100'
          )}
        >
          <Settings className="w-4 h-4" aria-hidden="true" />
          Configuración
        </Link>
        <button
          onClick={handleLogout}
          aria-label="Cerrar sesión"
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100 w-full transition-colors"
        >
          <LogOut className="w-4 h-4" aria-hidden="true" />
          Cerrar sesión
        </button>
      </div>
    </aside>
  )
}
