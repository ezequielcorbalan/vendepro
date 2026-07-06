'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Settings, LogOut, FileBarChart, ExternalLink, PanelLeftClose, PanelLeftOpen, Search, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import GlobalSearch from './GlobalSearch'
import NotificationBell from './NotificationBell'
import { menuSections, adminSection, type NavLink } from '@/lib/nav-config'
import { apiFetch, clearToken } from '@/lib/api'
import type { Profile } from '@/lib/types'

const COLLAPSE_KEY = 'sidebar_collapsed'

export default function Sidebar({ profile }: { profile: Profile }) {
  const pathname = usePathname()
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({})

  // Persistimos la preferencia. Se lee post-mount para no romper la hidratación.
  useEffect(() => {
    if (localStorage.getItem(COLLAPSE_KEY) === '1') setCollapsed(true)
  }, [])
  const toggle = () => setCollapsed(prev => {
    const next = !prev
    localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0')
    return next
  })

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

  const settingsActive = pathname.startsWith('/configuracion') || pathname.startsWith('/perfil')

  const isLeafActive = (link: NavLink) =>
    !link.external && (pathname === link.href || (!link.exact && pathname.startsWith(link.href + '/')))
  const isGroupActive = (link: NavLink) => !!link.children?.some(isLeafActive)
  const toggleGroup = (href: string, activeDefault: boolean) =>
    setOpenGroups(prev => ({ ...prev, [href]: !(prev[href] ?? activeDefault) }))

  // Renderiza un link "hoja" (Link interno o <a> externo). `sub` ajusta el padding
  // cuando el item vive dentro de un grupo desplegable.
  const renderLeaf = (link: NavLink, sub = false) => {
    const Icon = link.icon
    const isActive = isLeafActive(link)
    const className = cn(
      'flex items-center rounded-lg text-sm font-medium transition-all relative group',
      collapsed ? 'justify-center h-11 w-11 mx-auto' : sub ? 'gap-3 px-3 py-2' : 'gap-3 px-3 py-2.5',
      isActive
        ? 'bg-gradient-to-r from-brand-pink/10 to-brand-orange/10 text-brand-pink shadow-sm'
        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
    )
    const inner = (
      <>
        {isActive && (
          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-gradient-to-b from-brand-pink to-brand-orange rounded-r-full" />
        )}
        <Icon className={cn('w-5 h-5 shrink-0 transition-transform', isActive && 'scale-110')} aria-hidden="true" />
        {!collapsed && link.label}
        {!collapsed && link.external && <ExternalLink className="w-3 h-3 ml-auto opacity-40" aria-hidden="true" />}
      </>
    )
    return link.external ? (
      <a
        key={link.href}
        href={link.href}
        target="_blank"
        rel="noopener noreferrer"
        title={collapsed ? link.label : undefined}
        className={className}
      >
        {inner}
      </a>
    ) : (
      <Link
        key={link.href}
        href={link.href}
        aria-current={isActive ? 'page' : undefined}
        title={collapsed ? link.label : undefined}
        className={className}
      >
        {inner}
      </Link>
    )
  }

  return (
    <aside
      className={cn(
        'sticky top-0 h-screen shrink-0 bg-white border-r border-gray-200 flex flex-col overflow-hidden transition-[width] duration-200 ease-out',
        collapsed ? 'w-[72px]' : 'w-64',
      )}
    >
      {!collapsed && (
        <img
          src="/brand/GV-27.png"
          alt=""
          aria-hidden="true"
          className="absolute -bottom-12 -right-12 w-48 h-48 opacity-5 pointer-events-none"
        />
      )}

      {/* Header */}
      <div className="p-4 border-b border-gray-100 relative">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-pink to-brand-orange" />
        {collapsed ? (
          <div className="flex flex-col items-center gap-2 pt-1">
            <button
              onClick={toggle}
              aria-label="Expandir menú"
              aria-expanded={false}
              title="Expandir menú"
              className="w-10 h-10 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-brand-pink transition-colors"
            >
              <PanelLeftOpen className="w-5 h-5" aria-hidden="true" />
            </button>
            <NotificationBell />
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-2">
              <img src="/brand/logo-horizontal.png" alt="VendéPro" className="h-9" />
              <div className="flex items-center gap-1">
                <NotificationBell />
                <button
                  onClick={toggle}
                  aria-label="Contraer menú"
                  aria-expanded={true}
                  title="Contraer menú"
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-brand-pink transition-colors"
                >
                  <PanelLeftClose className="w-5 h-5" aria-hidden="true" />
                </button>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
              <FileBarChart className="w-3 h-3" aria-hidden="true" /> Gestión inmobiliaria
            </p>
          </>
        )}
      </div>

      {/* Búsqueda */}
      <div className={cn('pt-3 pb-1', collapsed ? 'px-3' : 'px-4')}>
        {collapsed ? (
          <button
            onClick={toggle}
            aria-label="Buscar"
            title="Buscar"
            className="w-full h-10 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-brand-pink transition-colors"
          >
            <Search className="w-5 h-5" aria-hidden="true" />
          </button>
        ) : (
          <GlobalSearch />
        )}
      </div>

      {/* Navegación */}
      <nav className={cn('flex-1 overflow-y-auto py-4 space-y-4', collapsed ? 'px-2' : 'px-4')} aria-label="Navegación principal">
        {sections.map((section) => (
          <div key={section.title}>
            {!collapsed && (
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-3 mb-1">
                {section.title}
              </p>
            )}
            <div className="space-y-0.5">
              {section.links.map((link) => {
                // Link simple (sin hijos): render directo.
                if (!link.children) return renderLeaf(link)

                // Grupo desplegable. Colapsado: mostramos los hijos como iconos sueltos.
                if (collapsed) return link.children.map((child) => renderLeaf(child))

                // Expandido: acordeón. Abierto si el usuario lo abrió o si una ruta hija está activa.
                const groupActive = isGroupActive(link)
                const open = openGroups[link.href] ?? groupActive
                const GroupIcon = link.icon
                return (
                  <div key={link.href}>
                    <button
                      onClick={() => toggleGroup(link.href, groupActive)}
                      aria-expanded={open}
                      className={cn(
                        'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                        groupActive ? 'text-brand-pink' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      )}
                    >
                      <GroupIcon className="w-5 h-5 shrink-0" aria-hidden="true" />
                      <span className="flex-1 text-left">{link.label}</span>
                      <ChevronDown
                        className={cn('w-4 h-4 shrink-0 transition-transform opacity-60', open && 'rotate-180')}
                        aria-hidden="true"
                      />
                    </button>
                    {open && (
                      <div className="mt-0.5 ml-4 pl-2 border-l border-gray-100 space-y-0.5">
                        {link.children.map((child) => renderLeaf(child, true))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className={cn('border-t border-gray-100 py-4 space-y-1', collapsed ? 'px-2' : 'px-4')}>
        <Link
          href="/perfil"
          title={collapsed ? (profile.full_name || profile.email) : undefined}
          className={cn('flex items-center rounded-lg hover:bg-gray-50 transition-colors', collapsed ? 'justify-center py-2' : 'gap-3 px-3 py-2')}
        >
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-pink to-brand-orange flex items-center justify-center text-white font-semibold text-sm shadow-sm shrink-0" aria-hidden="true">
            {(profile.full_name || profile.email || '?').charAt(0).toUpperCase()}
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-800 truncate">{profile.full_name || profile.email}</p>
              <p className="text-xs text-gray-500 truncate">{profile.role === 'admin' ? 'Administrador' : 'Agente'}</p>
            </div>
          )}
        </Link>
        <Link
          href="/configuracion"
          aria-current={settingsActive ? 'page' : undefined}
          title={collapsed ? 'Configuración' : undefined}
          className={cn(
            'flex items-center rounded-lg text-sm font-medium transition-colors',
            collapsed ? 'justify-center h-11 w-11 mx-auto' : 'gap-3 px-3 py-2',
            settingsActive ? 'bg-brand-pink/10 text-brand-pink' : 'text-gray-600 hover:bg-gray-100'
          )}
        >
          <Settings className="w-4 h-4 shrink-0" aria-hidden="true" />
          {!collapsed && 'Configuración'}
        </Link>
        <button
          onClick={handleLogout}
          aria-label="Cerrar sesión"
          title={collapsed ? 'Cerrar sesión' : undefined}
          className={cn(
            'flex items-center rounded-lg text-sm text-gray-600 hover:bg-gray-100 transition-colors w-full',
            collapsed ? 'justify-center h-11 w-11 mx-auto' : 'gap-3 px-3 py-2'
          )}
        >
          <LogOut className="w-4 h-4 shrink-0" aria-hidden="true" />
          {!collapsed && 'Cerrar sesión'}
        </button>
      </div>
    </aside>
  )
}
