'use client'

import Link from 'next/link'
import { Lock, Sparkles, Check } from 'lucide-react'
import { hasModule, moduleDefinition, type OrgModule } from '@/lib/modules'
import { useModules } from './ModulesProvider'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Heading, Text } from '@/components/ui/Typography'

/**
 * Deja pasar a la pantalla sólo si la org tiene el módulo activado; si no,
 * muestra de qué se trata y cómo conseguirlo.
 *
 * Es una barrera de producto, no de seguridad: corta el acceso a la pantalla,
 * pero las APIs siguen respondiendo. La validación por request va aparte.
 */
export function ModuleGate({ module, children }: { module: OrgModule; children: React.ReactNode }) {
  const state = useModules()
  if (hasModule(state, module)) return <>{children}</>
  return <ModuleLocked module={module} />
}

function ModuleLocked({ module }: { module: OrgModule }) {
  const state = useModules()
  const def = moduleDefinition(state, module)
  const others = state.catalog.filter(m => m.key !== module)

  return (
    <div className="max-w-2xl mx-auto py-10">
      <Card className="text-center">
        <div className="w-12 h-12 rounded-full bg-primary/10 text-primary grid place-items-center mx-auto">
          <Lock className="w-5 h-5" aria-hidden />
        </div>

        <Heading level={2} className="mt-4">{def?.label ?? 'Módulo no disponible'}</Heading>

        <Text tone="muted" className="mt-2">
          {def?.description ?? 'Este módulo no está activado en tu cuenta.'}
        </Text>

        <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-primary/10 text-primary px-3 py-1.5">
          <Sparkles className="w-4 h-4" aria-hidden />
          <Text size="sm" weight="medium" className="text-primary">Incluido en el plan PRO</Text>
        </div>

        {others.length > 0 && (
          <div className="mt-6 pt-6 border-t border-gray-200 text-left">
            <Text size="sm" weight="medium">El plan PRO también incluye</Text>
            <ul className="mt-3 space-y-2">
              {others.map(m => (
                <li key={m.key} className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-gray-600 shrink-0 mt-0.5" aria-hidden />
                  <Text size="sm" tone="muted">
                    <span className="text-ink font-medium">{m.label}</span> — {m.description}
                  </Text>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-6 pt-6 border-t border-gray-200">
          {/* ds-todo: el CTA de contratación todavía no tiene destino real
              (no hay checkout ni dirección de ventas definida). */}
          <Text size="sm" tone="muted">
            Escribinos para activarlo en tu cuenta y lo tenés funcionando el mismo día.
          </Text>
          <div className="mt-4">
            <Link href="/dashboard">
              <Button variant="outline">Volver al dashboard</Button>
            </Link>
          </div>
        </div>
      </Card>
    </div>
  )
}
