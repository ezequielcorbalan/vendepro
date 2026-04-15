'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LogOut, Menu, X, FileBarChart } from 'lucide-react'
import { cn } from '@/lib/utils'
import { agentMobileLinks, adminMobileLinks } from '@/lib/nav-config'
import { apiFetch, clearToken } from '@/lib/api'
import type { Profile } from '@/lib/types'

export default function MobileHeader({ profile }: { profile: Profile }) {
  const [open, setOpen] = useState(false)
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

  const links = (profile.role === 'admin' || profile.role === 'owner')
    ? [...agentMobileLinks, ...adminMobileLinks]
    : agentMobileLinks

  return (
    <>
      <header className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 h-16 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setOpen(true)}
            aria-label="Abrir menú de navegación"
            aria-expanded={open}
            className="p-2 -ml-2 rounded-lg hover:bg-gray-100"
          >
            <Menu className="w-5 h-5 text-gray-700" aria-hidden="true" />
          </button>
          <img src="/logo.png" alt="VendéPro" className="h-7" />
        </div>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-[#ff007c]/20 flex items-center justify-center text-[#ff007c] font-semibold text-sm" aria-hidden="true">
            {profile.full_name.charAt(0).toUpperCase()}
          </div>
        </div>
      </header>

      {open && (
        <div
          className="lg:hidden fixed inset-0 z-50 bg-black/50"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        >
          <aside
            className="w-72 bg-white h-full shadow-xl flex flex-col"
            role="dialog"
            aria-label="Menú de navegación"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <div>
                <img src="/logo.png" alt="VendéPro" className="h-8" />
                <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                  <FileBarChart className="w-3 h-3" aria-hidden="true" /> CRM Inmobiliario
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                aria-label="Cerrar menú"
                className="p-2 rounded-lg hover:bg-gray-100"
              >
                <X className="w-5 h-5 text-gray-500" aria-hidden="true" />
              </button>
            </div>

            <nav className="flex-1 p-4 space-y-1 overflow-y-auto" aria-label="Navegación principal">
              {links.map((link) => {
                const Icon = link.icon
                const isActive = pathname === link.href || (!link.exact && pathname.startsWith(link.href + '/'))
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setOpen(false)}
                    aria-current={isActive ? 'page' : undefined}
                    className={cn(
                      'flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-colors',
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
            </nav>

            <div className="p-4 border-t border-gray-100">
              <div className="flex items-center gap-3 px-3 py-2 mb-2">
                <div className="w-8 h-8 rounded-full bg-[#ff007c]/20 flex items-center justify-center text-[#ff007c] font-semibold text-sm" aria-hidden="true">
                  {profile.full_name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{profile.full_name}</p>
                  <p className="text-xs text-gray-500">{profile.role === 'admin' ? 'Administrador' : 'Agente'}</p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                aria-label="Cerrar sesión"
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-600 hover:bg-gray-100 w-full"
              >
                <LogOut className="w-4 h-4" aria-hidden="true" />
                Cerrar sesión
              </button>
            </div>
          </aside>
        </div>
      )}
    </>
  )
}
