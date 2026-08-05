'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Mail, Plus, Loader2, AlertCircle, Users, CheckCircle2, XCircle, Clock, Settings,
} from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { getCurrentUser } from '@/lib/auth'
import {
  type EmailCampaign, CAMPAIGN_STATUS, describeSegment, parseSegment, fmtDateTime,
} from '@/lib/email-campaigns'

export default function EmailCampaignsPage() {
  const profile = getCurrentUser()
  const isAdmin = profile?.role === 'admin' || profile?.role === 'owner'

  const [campaigns, setCampaigns] = useState<EmailCampaign[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    apiFetch('crm', '/marketing/email/campaigns')
      .then(r => r.json() as Promise<any>)
      .then(d => { setCampaigns(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => { setError(true); setLoading(false) })
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-brand-pink" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto py-12 text-center">
        <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
        <p className="text-gray-700 font-medium">No pudimos cargar las campañas</p>
        <p className="text-sm text-gray-500 mt-1">Probá recargar la página.</p>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-6 relative overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-pink to-brand-orange" />
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-brand-pink to-brand-orange flex items-center justify-center shadow-sm">
              <Mail className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-ink">Campañas de email</h1>
              <p className="text-sm text-gray-500 mt-0.5">Creá y enviá emails a tus contactos y leads — con ayuda de la IA</p>
            </div>
          </div>
          {isAdmin && (
            <div className="flex items-center gap-2">
              <Link
                href="/configuracion/marketing"
                className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-ink px-3 py-2"
              >
                <Settings className="w-4 h-4" /> Remitente
              </Link>
              <Link
                href="/marketing/emails/nueva"
                className="inline-flex items-center gap-2 bg-gradient-to-br from-brand-pink to-brand-orange text-white text-sm font-medium px-4 py-2 rounded-lg hover:opacity-90"
              >
                <Plus className="w-4 h-4" /> Nueva campaña
              </Link>
            </div>
          )}
        </div>
      </div>

      {campaigns.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-12 text-center">
          <Mail className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-700 font-medium mb-1">Todavía no hay campañas</p>
          <p className="text-sm text-gray-500 mb-6">
            Armá tu primera campaña: elegí la audiencia, generá el contenido con IA y enviala en minutos.
          </p>
          {isAdmin && (
            <Link
              href="/marketing/emails/nueva"
              className="inline-flex items-center gap-2 bg-gradient-to-br from-brand-pink to-brand-orange text-white text-sm font-medium px-5 py-2.5 rounded-lg hover:opacity-90"
            >
              <Plus className="w-4 h-4" /> Crear campaña
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {campaigns.map(c => {
            const st = CAMPAIGN_STATUS[c.status] ?? CAMPAIGN_STATUS.draft
            return (
              <Link
                key={c.id}
                href={`/marketing/emails/${c.id}`}
                className="block bg-white rounded-xl border border-gray-200 shadow-sm p-4 hover:border-brand-pink/40 transition-colors"
              >
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-ink truncate">{c.name}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${st.cls}`}>{st.label}</span>
                    </div>
                    <p className="text-sm text-gray-500 mt-0.5 truncate">
                      {c.subject || 'Sin asunto'} · {describeSegment(parseSegment(c.segment_json))}
                    </p>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-500 shrink-0">
                    {c.status === 'scheduled' && c.scheduled_at && (
                      <span className="inline-flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {fmtDateTime(c.scheduled_at)}</span>
                    )}
                    {(c.status === 'sending' || c.status === 'sent') && (
                      <>
                        <span className="inline-flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {c.total_recipients}</span>
                        <span className="inline-flex items-center gap-1 text-green-600"><CheckCircle2 className="w-3.5 h-3.5" /> {c.sent_count}</span>
                        {c.failed_count > 0 && (
                          <span className="inline-flex items-center gap-1 text-red-500"><XCircle className="w-3.5 h-3.5" /> {c.failed_count}</span>
                        )}
                      </>
                    )}
                    <span>{fmtDateTime(c.created_at)}</span>
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
