'use client'

import { useState, useEffect } from 'react'
import {
  Mail, Save, Loader2, Send, AlertCircle, CheckCircle2, XCircle, Ban,
} from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { Field, Input } from '@/components/ui/Input'
import { Checkbox } from '@/components/ui/Choice'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'

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
      <div className="bg-white rounded-card border border-gray-200 shadow-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Mail className="w-4 h-4 text-gray-600" />
          <h2 className="font-semibold text-ink">Remitente</h2>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          Nombre y dirección desde la que salen los emails de marketing. El dominio del
          remitente debe estar verificado en Resend para que los emails no caigan en spam.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Nombre remitente">
            <Input value={fromName} onChange={e => setFromName(e.target.value)} placeholder="Marcela Genta Inmobiliaria" />
          </Field>
          <Field label="Email remitente">
            <Input type="email" value={fromEmail} onChange={e => setFromEmail(e.target.value)} placeholder="novedades@tudominio.com.ar" />
          </Field>
          <Field label="Responder a (opcional)" hint="Las respuestas de los clientes llegan a esta casilla.">
            <Input type="email" value={replyTo} onChange={e => setReplyTo(e.target.value)} placeholder="contacto@tudominio.com.ar" />
          </Field>
          <div className="flex items-end pb-1">
            <Checkbox checked={enabled} onChange={setEnabled} label="Envío de emails habilitado" />
          </div>
        </div>
        <div className="mt-5 flex justify-end">
          <Button onClick={saveSettings} loading={saving} icon={<Save className="w-4 h-4" />}>
            Guardar
          </Button>
        </div>
      </div>

      {/* Email de prueba */}
      <div className="bg-white rounded-card border border-gray-200 shadow-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Send className="w-4 h-4 text-gray-600" />
          <h2 className="font-semibold text-ink">Email de prueba</h2>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          Verificá la configuración antes de habilitar campañas. El envío usa el remitente guardado.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <Input
            className="sm:max-w-xs"
            type="email"
            value={testTo}
            onChange={e => setTestTo(e.target.value)}
            placeholder="tu@email.com"
          />
          <Button
            variant="outline"
            onClick={sendTest}
            loading={testing}
            disabled={!fromEmail}
            icon={<Send className="w-4 h-4" />}
          >
            Enviar prueba
          </Button>
        </div>
        {!fromEmail && (
          <p className="flex items-center gap-1.5 text-xs text-warning mt-2">
            <AlertCircle className="w-3.5 h-3.5" /> Guardá primero un email remitente.
          </p>
        )}
        {testResult && (
          <Alert tone={testResult.ok ? 'success' : 'danger'} className="mt-4">
            {testResult.ok
              ? 'Email enviado. Revisá la casilla (y spam) para confirmar la recepción.'
              : `No se pudo enviar: ${testResult.error}`}
          </Alert>
        )}
      </div>

      {/* Lista de supresión */}
      <div className="bg-white rounded-card border border-gray-200 shadow-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Ban className="w-4 h-4 text-gray-500" />
          <h2 className="font-semibold text-ink">Lista de supresión</h2>
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
