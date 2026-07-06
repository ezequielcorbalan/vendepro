'use client'

import { useState, useEffect } from 'react'
import {
  Mail, Save, Loader2, Send, AlertCircle, CheckCircle2, XCircle, Ban,
} from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'

interface EmailSettings {
  configured: boolean
  from_name?: string | null
  from_email?: string | null
  reply_to?: string | null
  enabled?: boolean
  domain_status?: string
}

interface Suppression {
  id: string
  email: string
  reason: string
  source?: string | null
  created_at?: string
}

const REASON_LABELS: Record<string, string> = {
  unsubscribe: 'Baja voluntaria',
  bounce: 'Rebote',
  complaint: 'Queja (spam)',
  manual: 'Manual',
}

const fmtDate = (s?: string | null) =>
  s ? new Date(s.replace(' ', 'T')).toLocaleString('es-AR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'

export default function EmailSection() {
  const { toast } = useToast()

  const [loading, setLoading] = useState(true)
  const [fromName, setFromName] = useState('')
  const [fromEmail, setFromEmail] = useState('')
  const [replyTo, setReplyTo] = useState('')
  const [enabled, setEnabled] = useState(false)
  const [saving, setSaving] = useState(false)

  const [testTo, setTestTo] = useState('')
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; error?: string } | null>(null)

  const [suppressions, setSuppressions] = useState<Suppression[]>([])

  useEffect(() => {
    Promise.all([
      apiFetch('crm', '/marketing/email/settings').then(r => r.json() as Promise<any>).catch(() => ({ configured: false })),
      apiFetch('crm', '/marketing/email/suppressions').then(r => r.json() as Promise<any>).catch(() => []),
    ]).then(([cfg, sup]: [EmailSettings, any]) => {
      if (cfg?.configured) {
        setFromName(cfg.from_name ?? '')
        setFromEmail(cfg.from_email ?? '')
        setReplyTo(cfg.reply_to ?? '')
        setEnabled(!!cfg.enabled)
      }
      setSuppressions(Array.isArray(sup) ? sup : [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const emailValid = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())

  async function saveSettings() {
    if (enabled && !emailValid(fromEmail)) {
      toast('Completá un email remitente válido o desactivá el envío', 'error')
      return
    }
    setSaving(true)
    try {
      const res = await apiFetch('crm', '/marketing/email/settings', {
        method: 'PUT',
        body: JSON.stringify({
          from_name: fromName || null,
          from_email: fromEmail || null,
          reply_to: replyTo || null,
          enabled,
        }),
      })
      const data = (await res.json()) as any
      if (!res.ok) throw new Error(data?.error)
      toast('Configuración de email guardada')
    } catch (e: any) {
      toast(e?.message || 'Error guardando configuración', 'error')
    }
    setSaving(false)
  }

  async function sendTest() {
    if (!emailValid(testTo)) {
      toast('Ingresá un email de destino válido', 'error')
      return
    }
    setTesting(true)
    setTestResult(null)
    try {
      const res = await apiFetch('crm', '/marketing/email/test', {
        method: 'POST',
        body: JSON.stringify({ to: testTo.trim() }),
      })
      const data = (await res.json()) as any
      setTestResult(res.ok && data.ok ? { ok: true } : { ok: false, error: data?.error || 'Error desconocido' })
    } catch (e: any) {
      setTestResult({ ok: false, error: e?.message || 'Error de conexión' })
    }
    setTesting(false)
  }

  const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-pink/20 focus:border-brand-pink outline-none'
  const labelCls = 'block text-sm font-medium text-gray-700 mb-1'

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-brand-pink" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Remitente */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-center gap-2 mb-4">
          <Mail className="w-4 h-4 text-brand-pink" />
          <h2 className="font-semibold text-gray-800">Remitente</h2>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          Nombre y dirección desde la que salen los emails de marketing. El dominio del
          remitente debe estar verificado en Resend para que los emails no caigan en spam.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Nombre remitente</label>
            <input className={inputCls} value={fromName} onChange={e => setFromName(e.target.value)} placeholder="Marcela Genta Inmobiliaria" />
          </div>
          <div>
            <label className={labelCls}>Email remitente</label>
            <input className={inputCls} type="email" value={fromEmail} onChange={e => setFromEmail(e.target.value)} placeholder="novedades@tudominio.com.ar" />
          </div>
          <div>
            <label className={labelCls}>Responder a (opcional)</label>
            <input className={inputCls} type="email" value={replyTo} onChange={e => setReplyTo(e.target.value)} placeholder="contacto@tudominio.com.ar" />
            <p className="text-xs text-gray-400 mt-1">Las respuestas de los clientes llegan a esta casilla.</p>
          </div>
          <div className="flex items-end pb-1">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={enabled}
                onChange={e => setEnabled(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-brand-pink focus:ring-brand-pink/30"
              />
              <span className="text-sm text-gray-700">Envío de emails habilitado</span>
            </label>
          </div>
        </div>
        <div className="mt-5 flex justify-end">
          <button
            onClick={saveSettings}
            disabled={saving}
            className="inline-flex items-center gap-2 bg-brand-pink text-white text-sm font-medium px-4 py-2 rounded-lg hover:opacity-90 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Guardar
          </button>
        </div>
      </div>

      {/* Email de prueba */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-center gap-2 mb-4">
          <Send className="w-4 h-4 text-brand-orange" />
          <h2 className="font-semibold text-gray-800">Email de prueba</h2>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          Verificá la configuración antes de habilitar campañas. El envío usa el remitente guardado.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            className={`${inputCls} sm:max-w-xs`}
            type="email"
            value={testTo}
            onChange={e => setTestTo(e.target.value)}
            placeholder="tu@email.com"
          />
          <button
            onClick={sendTest}
            disabled={testing || !fromEmail}
            className="inline-flex items-center justify-center gap-2 border border-brand-orange text-brand-orange text-sm font-medium px-4 py-2 rounded-lg hover:bg-brand-orange/5 disabled:opacity-50"
          >
            {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Enviar prueba
          </button>
        </div>
        {!fromEmail && (
          <p className="flex items-center gap-1.5 text-xs text-amber-600 mt-2">
            <AlertCircle className="w-3.5 h-3.5" /> Guardá primero un email remitente.
          </p>
        )}
        {testResult && (
          <div className={`mt-4 flex items-start gap-2 rounded-lg px-3 py-2 text-sm ${testResult.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {testResult.ok
              ? <><CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" /> Email enviado. Revisá la casilla (y spam) para confirmar la recepción.</>
              : <><XCircle className="w-4 h-4 mt-0.5 shrink-0" /> <span>No se pudo enviar: {testResult.error}</span></>}
          </div>
        )}
      </div>

      {/* Lista de supresión */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-center gap-2 mb-4">
          <Ban className="w-4 h-4 text-gray-500" />
          <h2 className="font-semibold text-gray-800">Lista de supresión</h2>
          <span className="text-xs text-gray-400">({suppressions.length})</span>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          Direcciones que no reciben más emails de marketing: bajas voluntarias, rebotes y quejas.
          Se completa automáticamente — no requiere gestión manual.
        </p>
        {suppressions.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">Sin bajas registradas todavía.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
                  <th className="py-2 pr-4 font-medium">Email</th>
                  <th className="py-2 pr-4 font-medium">Motivo</th>
                  <th className="py-2 font-medium">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {suppressions.map(s => (
                  <tr key={s.id} className="border-b border-gray-50">
                    <td className="py-2 pr-4 text-gray-700">{s.email}</td>
                    <td className="py-2 pr-4">
                      <span className="inline-block text-xs bg-gray-100 text-gray-600 rounded-full px-2 py-0.5">
                        {REASON_LABELS[s.reason] ?? s.reason}
                      </span>
                    </td>
                    <td className="py-2 text-gray-500">{fmtDate(s.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
