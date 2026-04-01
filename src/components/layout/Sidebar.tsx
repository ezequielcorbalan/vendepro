'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import GlobalSearch from './GlobalSearch'
import NotificationBell from './NotificationBell'
import {
  LayoutDashboard,
  Building2,
  Users,
  LogOut,
  FileBarChart,
  ClipboardList,
  Settings,
  DollarSign,
  BarChart3,
  UserPlus,
  PhoneCall,
  BookUser,
  Activity,
  CalendarDays,
  Handshake,
  Target,
  Upload,
} from 'lucide-react'
import type { Profile } from '@/lib/types'

const menuSections = [
  {
    title: 'General',
    links: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/mi-performance', label: 'Mi Performance', icon: Target },
      { href: '/perfil', label: 'Mi Perfil', icon: Settings },
      { href: '/perfil/tasaciones', label: 'Mi Config Tasaciones', icon: ClipboardList },
      { href: '/perfil/objetivos', label: 'Mis Objetivos', icon: Target },
    ],
  },
  {
    title: 'CRM',
    links: [
      { href: '/leads', label: 'Leads', icon: UserPlus },
      { href: '/contactos', label: 'Contactos', icon: BookUser },
      { href: '/actividades', label: 'Actividad', icon: Activity },
      { href: '/calendario', label: 'Calendario', icon: CalendarDays },
    ],
  },
  {
    title: 'Comercialización',
    links: [
      { href: '/tasaciones', label: 'Tasaciones', icon: ClipboardList },
      { href: '/propiedades/pipeline', label: 'Pipeline', icon: Building2 },
      { href: '/propiedades', label: 'Reportes', icon: BarChart3 },
      { href: '/vendidas', label: 'Vendidas', icon: DollarSign },
      { href: '/reservas', label: 'Reservas', icon: Handshake },
    ],
  },
]

const adminSection = {
  title: 'Administración',
  links: [
    { href: '/admin/agentes', label: 'Agentes', icon: Users },
    { href: '/admin/objetivos', label: 'Objetivos equipo', icon: Target },
    { href: '/admin/importar', label: 'Importar', icon: Upload },
    { href: '/admin/auditoria', label: 'Auditoría', icon: FileBarChart },
    { href: '/configuracion', label: 'Configuración', icon: Settings },
  ],
}

export default function Sidebar({ profile }: { profile: Profile }) {
  const pathname = usePathname()
  const router = useRouter()

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }

  const sections = profile.role === 'admin'
    ? [...menuSections, adminSection]
    : menuSections

  return (
    <aside className="w-64 bg-white border-r border-gray-200 flex flex-col h-screen fixed left-0 top-0">
      <div className="p-6 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <img
            src="/logo.png"
            alt="Marcela Genta"
            className="h-10"
          />
          <NotificationBell />
        </div>
        <p className="text-xs text-brand-gray mt-2 flex items-center gap-1">
          <FileBarChart className="w-3 h-3" /> Gestión inmobiliaria
        </p>
      </div>

      <div className="px-4 pt-3 pb-1">
        <GlobalSearch />
      </div>

      <nav className="flex-1 p-4 space-y-4 overflow-y-auto">
        {sections.map((section) => (
          <div key={section.title}>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-3 mb-1">{section.title}</p>
            <div className="space-y-0.5">
              {section.links.map((link) => {
                const Icon = link.icon
                const isActive = pathname === link.href || pathname.startsWith(link.href + '/')
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
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
            </div>
          </div>
        ))}
      </nav>

      <div className="p-4 border-t border-gray-100">
        <div className="flex items-center gap-3 px-3 py-2 mb-2">
          <div className="w-8 h-8 rounded-full bg-brand-pink/20 flex items-center justify-center text-brand-pink font-semibold text-sm">
            {profile.full_name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-800 truncate">{profile.full_name}</p>
            <p className="text-xs text-brand-gray truncate">{profile.role === 'admin' ? 'Administrador' : 'Agente'}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100 w-full transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Cerrar sesión
        </button>
      </div>
    </aside>
  )
}
