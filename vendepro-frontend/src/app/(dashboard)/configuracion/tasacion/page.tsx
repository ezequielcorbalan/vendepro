'use client'
import { Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams, useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { TemplatesHome } from '@/components/tasaciones/admin/TemplatesHome'
import { StaticBlocksHome } from '@/components/tasaciones/admin/StaticBlocksHome'
import { PageHeader } from '@/components/ui/PageHeader'
import { Text } from '@/components/ui/Typography'
import { useCurrentUser } from '@/lib/use-current-user'
import { Button } from '@/components/ui/Button'

const ALL_TABS = [
  { key: 'templates', label: 'Templates', roles: ['admin', 'agent'] },
  { key: 'bloques-estaticos', label: 'Bloques estáticos', roles: ['admin'] },
] as const

function ConfigTasacionInner() {
  const qp = useSearchParams()
  const router = useRouter()
  const { user, listo } = useCurrentUser()
  const isAdmin = user?.role === 'admin'

  // Filter tabs by role — agents only see Templates
  // `listo` decide el título y qué pestañas hay, así que hasta que se sepa el
  // rol no se pinta ninguno de los dos: el servidor no ve `localStorage` y
  // ponía "Mis plantillas de tasación" donde el cliente ponía "Configuración".
  const userRole = user?.role || 'agent'
  const visibleTabs = ALL_TABS.filter(t => (t.roles as readonly string[]).includes(userRole))
  const active = (qp.get('tab') ?? 'templates') as typeof ALL_TABS[number]['key']

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-10">
      <Link
        href="/configuracion"
        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-ink mb-6"
      >
        <ArrowLeft className="w-4 h-4" /> Volver a Configuración
      </Link>
      <PageHeader title={!listo ? 'Tasaciones' : isAdmin ? 'Configuración · Tasaciones' : 'Mis plantillas de tasación'} />
      {listo && visibleTabs.length > 1 && (
        <nav className="mt-6 border-b border-gray-200">
          {visibleTabs.map(t => (
            <Button variant="ghost" size="icon"
              key={t.key}
              onClick={() => router.push(`/configuracion/tasacion?tab=${t.key}`)}
              className={`border-b-2 px-4 py-2 text-sm ${
                active === t.key
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
            </Button>
          ))}
        </nav>
      )}
      <div className="mt-6">
        {active === 'templates' && <TemplatesHome />}
        {active === 'bloques-estaticos' && isAdmin && <StaticBlocksHome />}
      </div>
    </div>
  )
}

export default function ConfigTasacionPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-24"><Text tone="muted">Cargando...</Text></div>}>
      <ConfigTasacionInner />
    </Suspense>
  )
}
