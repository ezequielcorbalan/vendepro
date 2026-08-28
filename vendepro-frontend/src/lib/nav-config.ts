// ============================================================
// Navigation config — single source of truth for sidebar & mobile nav
// ============================================================

import {
  LayoutDashboard,
  Building2,
  Users,
  FileBarChart,
  ClipboardList,
  Settings,
  DollarSign,
  BarChart3,
  BookUser,
  Activity,
  CalendarDays,
  UserCheck,
  FileCheck,
  Target,
  Home,
  Globe,
  Megaphone,
  Briefcase,
  Mail,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import type { OrgModule } from './modules'

export interface NavLink {
  href: string
  label: string
  icon: LucideIcon
  /** When true, only exact path match triggers active state */
  exact?: boolean
  /** When true, renders as <a target="_blank"> instead of Next.js Link */
  external?: boolean
  /** Extra pathnames that should also mark this link as active (e.g. sibling tabs) */
  matchPaths?: string[]
  /**
   * When present, this link is a collapsible group. `href` acts only as a
   * stable key/identity (not a navigable route) and the group is active when
   * any child is active.
   */
  children?: NavLink[]
  /**
   * Módulo del plan que habilita este link. Si la org no lo tiene activado, el
   * ítem se muestra con candado y lleva a la pantalla que explica el módulo.
   */
  module?: OrgModule
}

export interface NavSection {
  title: string
  links: NavLink[]
}

export const menuSections: NavSection[] = [
  {
    title: 'Principal',
    links: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/calendario', label: 'Calendario', icon: CalendarDays },
      { href: '/actividades', label: 'Actividad', icon: Activity, matchPaths: ['/mi-performance'] },
    ],
  },
  {
    title: 'CRM',
    links: [
      { href: '/leads', label: 'Leads', icon: BookUser },
      { href: '/contactos', label: 'Contactos', icon: UserCheck },
    ],
  },
  {
    title: 'Comercial',
    links: [
      { href: '/tasaciones', label: 'Tasaciones', icon: ClipboardList },
      { href: '/propiedades/pipeline', label: 'Pipeline', icon: Building2 },
      { href: '/propiedades', label: 'Propiedades', icon: BarChart3, exact: true },
      {
        href: '/operaciones',
        label: 'Operaciones',
        icon: Briefcase,
        children: [
          { href: '/reportes', label: 'Reportes', icon: FileBarChart },
          { href: '/reservas', label: 'Reservas', icon: FileCheck },
          { href: '/vendidas', label: 'Vendidas', icon: DollarSign },
          { href: '/alquiladas', label: 'Alquiladas', icon: Home },
        ],
      },
    ],
  },
  // Toda la sección es parte del plan PRO, y cada módulo se activa a mano.
  {
    title: 'Marketing',
    links: [
      { href: '/marketing', label: 'Publicidad', icon: Megaphone, exact: true, module: 'publicidad' },
      { href: '/marketing/emails', label: 'Emails', icon: Mail, module: 'emails' },
      { href: '/landings', label: 'Landings', icon: Globe, module: 'landings' },
      // La pantalla sigue viviendo bajo /configuracion (es donde se armó), pero
      // el módulo se usa desde Marketing. `matchPaths` cubre el alias viejo.
      {
        href: '/configuracion/automatizaciones',
        label: 'Automatizaciones',
        icon: Zap,
        matchPaths: ['/marketing/automations'],
        module: 'automatizaciones',
      },
    ],
  },
]

export const adminSection: NavSection = {
  title: 'Administración',
  links: [
    { href: '/admin/agentes', label: 'Equipo', icon: Users },
    { href: '/admin/auditoria', label: 'Auditoría', icon: FileBarChart },
  ],
}

export const adminMobileLinks: NavLink[] = [
  { href: '/admin/agentes', label: 'Agentes', icon: Users },
  { href: '/admin/objetivos', label: 'Objetivos', icon: Target },
  { href: '/admin/auditoria', label: 'Auditoría', icon: FileBarChart },
]

/** All agent links for mobile nav (flat list — groups expanded to their children) */
export const agentMobileLinks: NavLink[] = [
  ...menuSections.flatMap(s => s.links.flatMap(l => (l.children ? l.children : [l]))),
  { href: '/configuracion', label: 'Configuración', icon: Settings },
]
