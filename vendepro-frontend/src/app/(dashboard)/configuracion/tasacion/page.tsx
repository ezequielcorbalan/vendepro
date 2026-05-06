'use client'
import { Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { TemplatesHome } from '@/components/tasaciones/admin/TemplatesHome'
import { VariablesHome } from '@/components/tasaciones/admin/VariablesHome'
import { OrgConfigForm } from '@/components/tasaciones/admin/OrgConfigForm'
import { getCurrentUser } from '@/lib/auth'

const ALL_TABS = [
  { key: 'templates', label: 'Templates', roles: ['admin', 'agent'] },
  { key: 'variables', label: 'Variables', roles: ['admin'] },
  { key: 'general', label: 'General', roles: ['admin'] },
] as const

function ConfigTasacionInner() {
  const qp = useSearchParams()
  const router = useRouter()
  const user = getCurrentUser()
  const isAdmin = user?.role === 'admin'

  // Filter tabs by role — agents only see Templates
  const visibleTabs = ALL_TABS.filter(t => t.roles.includes(user?.role || 'agent'))
  const active = (qp.get('tab') ?? 'templates') as typeof ALL_TABS[number]['key']

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-10">
      <h1 className="text-2xl font-bold">
        {isAdmin ? 'Configuración · Tasaciones' : 'Mis plantillas de tasación'}
      </h1>
      {visibleTabs.length > 1 && (
        <nav className="mt-6 border-b border-slate-200">
          {visibleTabs.map(t => (
            <button
              key={t.key}
              onClick={() => router.push(`/configuracion/tasacion?tab=${t.key}`)}
              className={`border-b-2 px-4 py-2 text-sm ${
                active === t.key
                  ? 'border-[#ff007c] text-[#ff007c]'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      )}
      <div className="mt-6">
        {active === 'templates' && <TemplatesHome />}
        {active === 'variables' && isAdmin && <VariablesHome />}
        {active === 'general' && isAdmin && <OrgConfigForm />}
      </div>
    </div>
  )
}

export default function ConfigTasacionPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-24 text-slate-400">Cargando...</div>}>
      <ConfigTasacionInner />
    </Suspense>
  )
}
