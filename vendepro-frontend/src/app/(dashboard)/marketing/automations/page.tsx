'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Workflow, Plus, Loader2, Users, Zap, Hand, Layers,
} from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { getCurrentUser } from '@/lib/auth'
import {
  type EmailAutomation, AUTOMATION_STATUS, triggerLabel, fmtDateTime,
} from '@/lib/email-automations'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import { Alert } from '@/components/ui/Alert'
import { Card } from '@/components/ui/Card'

export default function AutomationsPage() {
  const profile = getCurrentUser()
  const isAdmin = profile?.role === 'admin' || profile?.role === 'owner'

  const [items, setItems] = useState<EmailAutomation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    apiFetch('crm', '/marketing/email/automations')
      .then(r => r.json() as Promise<any>)
      .then(d => { setItems(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => { setError(true); setLoading(false) })
  }, [])

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
  }
  if (error) {
    return (
      <div className="max-w-2xl mx-auto py-12">
        <Alert tone="danger" title="No pudimos cargar las automatizaciones" />
      </div>
    )
  }

  const newButton = isAdmin ? (
    <Link
      href="/marketing/automations/nueva"
      className="inline-flex items-center gap-2 bg-primary text-white text-sm font-medium px-4 py-2 rounded-control hover:bg-primary-hover"
    >
      <Plus className="w-4 h-4" /> Nueva automatización
    </Link>
  ) : undefined

  return (
    <div>
      <PageHeader
        title="Automatizaciones"
        subtitle="Secuencias de emails que se envían solas a lo largo del tiempo"
        actions={newButton}
        className="mb-6"
      />

      {items.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Workflow className="w-6 h-6" />}
            title="Todavía no hay automatizaciones"
            description="Creá una secuencia de bienvenida, seguimiento o reactivación. La IA arma los emails y VendéPro los envía solo, espaciados en el tiempo."
            action={isAdmin ? (
              <Link
                href="/marketing/automations/nueva"
                className="inline-flex items-center gap-2 bg-primary text-white text-sm font-medium px-5 py-2.5 rounded-control hover:bg-primary-hover"
              >
                <Plus className="w-4 h-4" /> Crear automatización
              </Link>
            ) : undefined}
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map(a => {
            const st = AUTOMATION_STATUS[a.status] ?? AUTOMATION_STATUS.draft
            const isManual = !a.trigger_event
            return (
              <Link
                key={a.id}
                href={`/marketing/automations/${a.id}`}
                className="block bg-white rounded-card border border-gray-200 shadow-card p-4 hover:border-primary/40 transition-colors"
              >
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-ink truncate">{a.name}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${st.cls}`}>{st.label}</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-gray-500 mt-0.5">
                      <span className="inline-flex items-center gap-1">
                        {isManual ? <Hand className="w-3.5 h-3.5" /> : <Zap className="w-3.5 h-3.5" />}
                        {triggerLabel(a.trigger_event)}
                      </span>
                      <span className="inline-flex items-center gap-1"><Layers className="w-3.5 h-3.5" /> {a.step_count ?? 0} paso{(a.step_count ?? 0) === 1 ? '' : 's'}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-500 shrink-0">
                    {(a.active_enrollments ?? 0) > 0 && (
                      <span className="inline-flex items-center gap-1 text-blue-600"><Users className="w-3.5 h-3.5" /> {a.active_enrollments} en curso</span>
                    )}
                    <span>{fmtDateTime(a.created_at)}</span>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
