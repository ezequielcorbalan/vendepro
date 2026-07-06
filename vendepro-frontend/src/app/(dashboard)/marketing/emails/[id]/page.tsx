'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Loader2, AlertCircle, Users, CheckCircle2, XCircle, Clock,
  Pencil, Trash2, Ban, Send, RefreshCw,
} from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import {
  type EmailCampaign, type CampaignSend, CAMPAIGN_STATUS,
  describeSegment, parseSegment, fmtDateTime,
} from '@/lib/email-campaigns'

type CampaignDetail = EmailCampaign & { sends: CampaignSend[] }

export default function EmailCampaignDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { toast } = useToast()

  const [campaign, setCampaign] = useState<CampaignDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [working, setWorking] = useState(false)

  const load = useCallback(() => {
    apiFetch('crm', `/marketing/email/campaigns/${id}`)
      .then(r => r.json() as Promise<any>)
      .then(d => { if (d?.id) setCampaign(d); else setError(true); setLoading(false) })
      .catch(() => { setError(true); setLoading(false) })
  }, [id])

  useEffect(() => { load() }, [load])

  // Refresco automático mientras la campaña está saliendo.
  useEffect(() => {
    if (campaign?.status !== 'sending') return
    const t = setInterval(load, 5000)
    return () => clearInterval(t)
  }, [campaign?.status, load])

  async function cancelCampaign() {
    setWorking(true)
    try {
      const res = await apiFetch('crm', `/marketing/email/campaigns/${id}/cancel`, { method: 'POST' })
      if (!res.ok) throw new Error(((await res.json()) as any)?.error)
      toast('Campaña cancelada — volvió a borrador')
      load()
    } catch (e: any) {
      toast(e?.message || 'No se pudo cancelar', 'error')
    }
    setWorking(false)
  }

  async function deleteCampaign() {
    if (!confirm('¿Borrar esta campaña? Esta acción no se puede deshacer.')) return
    setWorking(true)
    try {
      const res = await apiFetch('crm', `/marketing/email/campaigns/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error(((await res.json()) as any)?.error)
      toast('Campaña borrada')
      router.push('/marketing/emails')
    } catch (e: any) {
      toast(e?.message || 'No se pudo borrar', 'error')
      setWorking(false)
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-brand-pink" /></div>
  }
  if (error || !campaign) {
    return (
      <div className="max-w-2xl mx-auto py-12 text-center">
        <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
        <p className="text-gray-700 font-medium">Campaña no encontrada</p>
        <Link href="/marketing/emails" className="text-sm text-brand-pink hover:underline mt-2 inline-block">Volver a campañas</Link>
      </div>
    )
  }

  const st = CAMPAIGN_STATUS[campaign.status] ?? CAMPAIGN_STATUS.draft
  const progress = campaign.total_recipients > 0
    ? Math.round((campaign.sent_count / campaign.total_recipients) * 100)
    : 0

  return (
    <div className="max-w-4xl mx-auto">
      <Link href="/marketing/emails" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 mb-6">
        <ArrowLeft className="w-4 h-4" /> Volver a campañas
      </Link>

      {/* Header */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-5">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-semibold text-gray-800 truncate">{campaign.name}</h1>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${st.cls}`}>{st.label}</span>
            </div>
            <p className="text-sm text-gray-500 mt-1">{campaign.subject || 'Sin asunto'}</p>
            <p className="text-xs text-gray-400 mt-1">
              {describeSegment(parseSegment(campaign.segment_json))}
              {campaign.status === 'scheduled' && campaign.scheduled_at && ` · programada ${fmtDateTime(campaign.scheduled_at)}`}
              {campaign.sent_at && ` · enviada ${fmtDateTime(campaign.sent_at)}`}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {campaign.status === 'sending' && (
              <button onClick={load} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 px-3 py-1.5">
                <RefreshCw className="w-4 h-4" /> Actualizar
              </button>
            )}
            {campaign.status === 'draft' && (
              <>
                <Link
                  href={`/marketing/emails/nueva?id=${campaign.id}`}
                  className="inline-flex items-center gap-1.5 text-sm border border-gray-200 text-gray-700 px-3 py-1.5 rounded-lg hover:border-gray-300"
                >
                  <Pencil className="w-3.5 h-3.5" /> Editar
                </Link>
                <Link
                  href={`/marketing/emails/nueva?id=${campaign.id}`}
                  className="inline-flex items-center gap-1.5 bg-gradient-to-br from-brand-pink to-brand-orange text-white text-sm font-medium px-3.5 py-1.5 rounded-lg hover:opacity-90"
                >
                  <Send className="w-3.5 h-3.5" /> Continuar y enviar
                </Link>
                <button
                  onClick={deleteCampaign}
                  disabled={working}
                  className="p-2 text-gray-400 hover:text-red-500"
                  title="Borrar campaña"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            )}
            {campaign.status === 'scheduled' && (
              <button
                onClick={cancelCampaign}
                disabled={working}
                className="inline-flex items-center gap-1.5 text-sm border border-gray-200 text-gray-700 px-3 py-1.5 rounded-lg hover:border-gray-300 disabled:opacity-50"
              >
                <Ban className="w-3.5 h-3.5" /> Cancelar programación
              </button>
            )}
          </div>
        </div>

        {/* Progreso */}
        {(campaign.status === 'sending' || campaign.status === 'sent') && (
          <div className="mt-5">
            <div className="flex items-center justify-between text-sm mb-1.5">
              <div className="flex items-center gap-4 text-gray-600">
                <span className="inline-flex items-center gap-1"><Users className="w-4 h-4" /> {campaign.total_recipients}</span>
                <span className="inline-flex items-center gap-1 text-green-600"><CheckCircle2 className="w-4 h-4" /> {campaign.sent_count} enviados</span>
                {campaign.failed_count > 0 && (
                  <span className="inline-flex items-center gap-1 text-red-500"><XCircle className="w-4 h-4" /> {campaign.failed_count} fallidos</span>
                )}
              </div>
              <span className="text-gray-400 text-xs">{progress}%</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-brand-pink to-brand-orange transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Vista previa */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Vista previa</h2>
          {campaign.html ? (
            <iframe srcDoc={campaign.html} sandbox="" title="Vista previa" className="w-full h-[420px] border border-gray-100 rounded-xl" />
          ) : (
            <p className="text-sm text-gray-400 py-8 text-center">Sin contenido todavía.</p>
          )}
        </div>

        {/* Destinatarios */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">
            Destinatarios {campaign.sends.length > 0 && <span className="text-gray-400 font-normal">({campaign.sends.length})</span>}
          </h2>
          {campaign.sends.length === 0 ? (
            <p className="text-sm text-gray-400 py-8 text-center">
              La lista se congela al enviar — todavía no hay destinatarios encolados.
            </p>
          ) : (
            <div className="overflow-y-auto max-h-[420px]">
              <table className="w-full text-sm">
                <tbody>
                  {campaign.sends.map(s => (
                    <tr key={s.id} className="border-b border-gray-50">
                      <td className="py-1.5 pr-2 text-gray-700 truncate max-w-[200px]" title={s.email}>{s.email}</td>
                      <td className="py-1.5 text-right">
                        {s.status === 'sent' ? (
                          <span className="inline-flex items-center gap-1 text-xs text-green-600"><CheckCircle2 className="w-3 h-3" /> Enviado</span>
                        ) : s.status === 'failed' ? (
                          <span className="inline-flex items-center gap-1 text-xs text-red-500" title={s.error ?? ''}><XCircle className="w-3 h-3" /> Falló</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-gray-400"><Clock className="w-3 h-3" /> Pendiente</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
