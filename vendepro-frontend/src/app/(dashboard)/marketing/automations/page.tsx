'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Workflow, Plus, Loader2, AlertCircle, Users, Zap, Hand, Layers,
} from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { getCurrentUser } from '@/lib/auth'
import {
  type EmailAutomation, AUTOMATION_STATUS, triggerLabel, fmtDateTime,
} from '@/lib/email-automations'

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
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-brand-pink" /></div>
  }
  if (error) {
    return (
      <div className="max-w-2xl mx-auto py-12 text-center">
        <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
        <p className="text-gray-700 font-medium">No pudimos cargar las automatizaciones</p>
      </div>
    )
  }

  return (
    <div>
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-6 relative overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-pink to-brand-orange" />
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-brand-pink to-brand-orange flex items-center justify-center shadow-sm">
              <Workflow className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-800">Automatizaciones</h1>
              <p className="text-sm text-gray-500 mt-0.5">Secuencias de emails que se envían solas a lo largo del tiempo</p>
            </div>
          </div>
          {isAdmin && (
            <Link
              href="/marketing/automations/nueva"
              className="inline-flex items-center gap-2 bg-gradient-to-br from-brand-pink to-brand-orange text-white text-sm font-medium px-4 py-2 rounded-lg hover:opacity-90"
            >
              <Plus className="w-4 h-4" /> Nueva automatización
            </Link>
          )}
        </div>
      </div>

      {items.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-12 text-center">
          <Workflow className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-700 font-medium mb-1">Todavía no hay automatizaciones</p>
          <p className="text-sm text-gray-500 mb-6 max-w-md mx-auto">
            Creá una secuencia de bienvenida, seguimiento o reactivación. La IA arma los emails
            y VendéPro los envía solo, espaciados en el tiempo.
          </p>
          {isAdmin && (
            <Link
              href="/marketing/automations/nueva"
              className="inline-flex items-center gap-2 bg-gradient-to-br from-brand-pink to-brand-orange text-white text-sm font-medium px-5 py-2.5 rounded-lg hover:opacity-90"
            >
              <Plus className="w-4 h-4" /> Crear automatización
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {items.map(a => {
            const st = AUTOMATION_STATUS[a.status] ?? AUTOMATION_STATUS.draft
            const isManual = !a.trigger_event
            return (
              <Link
                key={a.id}
                href={`/marketing/automations/${a.id}`}
                className="block bg-white rounded-xl border border-gray-200 shadow-sm p-4 hover:border-brand-pink/40 transition-colors"
              >
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-gray-800 truncate">{a.name}</span>
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
