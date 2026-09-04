'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LogOut, Menu, FileBarChart } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Drawer } from '@/components/ui/Drawer'
import { Text } from '@/components/ui/Typography'
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
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setOpen(true)}
            aria-label="Abrir menú de navegación"
            aria-expanded={open}
            className="-ml-2"
          >
            <Menu className="w-5 h-5" aria-hidden="true" />
          </Button>
          <img src="/brand/logo-horizontal.png" alt="VendéPro" className="h-7" />
        </div>
        <div className="flex items-center gap-2">
          <Avatar size="sm" name={profile.full_name || profile.email || '?'} />
        </div>
      </header>

      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        side="left"
        width="w-72"
        className="lg:hidden"
        padded={false}
        title="Menú de navegación"
        header={
          <div>
            <img src="/brand/logo-horizontal.png" alt="VendéPro" className="h-8" />
            <Text size="xs" tone="muted" className="mt-1 flex items-center gap-1">
              <FileBarChart className="w-3 h-3" aria-hidden="true" /> CRM Inmobiliario
            </Text>
          </div>
        }
        footer={
          <div className="w-full">
            <div className="flex items-center gap-3 px-3 py-2 mb-2">
              <Avatar size="sm" name={profile.full_name || profile.email || '?'} />
              <div className="flex-1 min-w-0">
                <Text weight="medium" className="truncate">{profile.full_name || profile.email}</Text>
                <Text size="xs" tone="muted">{profile.role === 'admin' ? 'Administrador' : 'Agente'}</Text>
              </div>
            </div>
            <Button
              variant="ghost"
              fullWidth
              onClick={handleLogout}
              aria-label="Cerrar sesión"
              icon={<LogOut className="w-4 h-4" aria-hidden="true" />}
              className="justify-start gap-3 px-3 py-2.5 text-gray-600"
            >
              Cerrar sesión
            </Button>
          </div>
        }
      >
            <nav className="p-4 space-y-1" aria-label="Navegación principal">
              {links.map((link) => {
                const Icon = link.icon
                const isActive = pathname === link.href
                  || (!link.exact && pathname.startsWith(link.href + '/'))
                  || !!link.matchPaths?.some((p) => pathname === p || pathname.startsWith(p + '/'))
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setOpen(false)}
                    aria-current={isActive ? 'page' : undefined}
                    className={cn(
                      'flex items-center gap-3 px-3 py-3 rounded-control text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-primary/10 text-primary'
                        : 'text-gray-600 hover:bg-gray-100'
                    )}
                  >
                    <Icon className="w-5 h-5" aria-hidden="true" />
                    {link.label}
                  </Link>
                )
              })}
            </nav>
      </Drawer>
    </>
  )
}
