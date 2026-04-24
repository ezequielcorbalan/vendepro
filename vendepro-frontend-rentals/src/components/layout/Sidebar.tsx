'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Home, FileText, DollarSign, TrendingDown, Zap, TrendingUp, Users,
  Building2, Globe, BarChart2, Receipt, Settings, ChevronDown, ChevronRight,
  Plus, Minus, House, Clock,
} from 'lucide-react'

type NavItem = {
  label: string
  href?: string
  icon?: React.FC<{ size?: number; className?: string }>
  badge?: string
  children?: NavItem[]
}

const NAV: NavItem[] = [
  { label: 'Inicio', href: '/', icon: Home },
  { label: 'Contratos', href: '/rentals', icon: FileText },
  {
    label: 'Cobros', icon: DollarSign,
    children: [
      { label: 'Cobros', href: '/payments' },
      { label: 'Cobros pendientes', href: '/upcoming_payments', badge: 'pending' },
    ],
  },
  { label: 'Gastos', href: '/expenses', icon: TrendingDown },
  { label: 'Servicios', href: '/services', icon: Zap },
  { label: 'Otros ingresos', href: '/other_income', icon: TrendingUp },
  {
    label: 'Personas', icon: Users,
    children: [
      { label: 'Inquilinos', href: '/tenants' },
      { label: 'Garantes', href: '/co_signers' },
      { label: 'Propietarios', href: '/landlords' },
    ],
  },
  { label: 'Propiedades', href: '/properties', icon: Building2 },
  { label: 'Portales', href: '/tenant_portals', icon: Globe },
  {
    label: 'Reportes', icon: BarChart2,
    children: [
      { label: 'Resumen del mes', href: '/summary' },
      { label: 'Liquidaciones', href: '/landlord_statements' },
    ],
  },
  { label: 'Facturas', href: '/invoicing', icon: Receipt },
]

const FOOTER_NAV: NavItem[] = [
  { label: 'Preferencias', href: '/account', icon: Settings },
]

function isActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/'
  return pathname.startsWith(href)
}

export default function Sidebar({
  onNewPayment,
  onNewExpense,
}: {
  onNewPayment?: () => void
  onNewExpense?: () => void
}) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  useEffect(() => {
    try {
      const saved = localStorage.getItem('rentals_sidebar_collapsed')
      if (saved) setCollapsed(JSON.parse(saved))
    } catch {}
  }, [])

  function toggle(label: string) {
    setCollapsed(prev => {
      const next = { ...prev, [label]: !prev[label] }
      try { localStorage.setItem('rentals_sidebar_collapsed', JSON.stringify(next)) } catch {}
      return next
    })
  }

  function isGroupActive(children: NavItem[]) {
    return children.some(c => c.href && isActive(pathname, c.href))
  }

  const linkClass = (href: string) =>
    `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all ${
      isActive(pathname, href)
        ? 'bg-gradient-to-r from-[#ff007c]/20 to-[#ff8017]/20 border-l-2 border-[#ff007c] text-white font-medium pl-[10px]'
        : 'text-slate-400 hover:text-white hover:bg-white/5'
    }`

  return (
    <aside className="w-60 shrink-0 flex flex-col h-screen overflow-hidden" style={{ background: '#1a0d2e' }}>
      {/* Logo */}
      <div className="px-4 py-5 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(255,0,124,0.2)' }}>
            <House size={16} color="#ff007c" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-white font-semibold text-sm leading-tight">VendéPro Alquileres</span>
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full leading-none" style={{ background: 'rgba(255,0,124,0.2)', color: '#ff007c' }}>beta</span>
            </div>
            <div className="text-slate-400 text-xs mt-0.5">Gestión de alquileres</div>
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="px-3 py-3 border-b border-white/10 flex gap-2">
        <button
          onClick={onNewPayment}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium text-white transition-opacity hover:opacity-80"
          style={{ background: '#16a34a' }}
        >
          <Plus size={13} /> Cobro
        </button>
        <button
          onClick={onNewExpense}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium text-white transition-opacity hover:opacity-80"
          style={{ background: '#dc2626' }}
        >
          <Minus size={13} /> Gasto
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
        {NAV.map(item => {
          if (item.children) {
            const open = collapsed[item.label] !== undefined ? !collapsed[item.label] : isGroupActive(item.children)
            const Icon = item.icon
            return (
              <div key={item.label}>
                <button
                  onClick={() => toggle(item.label)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-white/5 transition-all"
                >
                  {Icon && <Icon size={16} />}
                  <span className="flex-1 text-left">{item.label}</span>
                  {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>
                {open && (
                  <div className="ml-4 mt-0.5 space-y-0.5">
                    {item.children.map(child => (
                      <Link key={child.href} href={child.href!} className={linkClass(child.href!)}>
                        <span className="w-1 h-1 rounded-full bg-current shrink-0" />
                        <span className="flex-1">{child.label}</span>
                        {child.badge === 'pending' && (
                          <span className="text-[10px] bg-orange-500/20 text-orange-400 px-1.5 py-0.5 rounded-full">!</span>
                        )}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )
          }
          const Icon = item.icon
          return (
            <Link key={item.href} href={item.href!} className={linkClass(item.href!)}>
              {Icon && <Icon size={16} />}
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 py-3 border-t border-white/10">
        {FOOTER_NAV.map(item => {
          const Icon = item.icon
          return (
            <Link key={item.href} href={item.href!} className={linkClass(item.href!)}>
              {Icon && <Icon size={16} />}
              <span>{item.label}</span>
            </Link>
          )
        })}
      </div>
    </aside>
  )
}
