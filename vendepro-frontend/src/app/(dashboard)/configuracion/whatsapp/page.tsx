'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  MessageCircle, ArrowLeft, Save, Loader2, Send, CheckCircle2,
  AlertCircle, Bot, Bell, Copy, Code,
} from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { getCurrentUser } from '@/lib/auth'

interface WhatsappConfig {
  provider: string
  api_token_encrypted: string | null
  webhook_secret: string | null
  welcome_template: string
  bot_enabled: boolean
  notify_agent_email: boolean
  notify_admin_email: boolean
}

export default function WhatsappConfigPage() {
  const { toast } = useToast()
  const isAdmin = getCurrentUser()?.role === 'admin'

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testPhone, setTestPhone] = useState('')

  const [apiToken, setApiToken] = useState('')
  const [webhookSecret, setWebhookSecret] = useState('')
  const [welcomeTemplate, setWelcomeTemplate] = useState(
    'Hola {{name}}! Gracias por contactarnos. ¿Estás buscando comprar/alquilar o querés vender/tasar una propiedad?'
  )
  const [botEnabled, setBotEnabled] = useState(true)
  const [notifyAgent, setNotifyAgent] = useState(true)
  const [notifyAdmin, setNotifyAdmin] = useState(true)
  const [hasToken, setHasToken] = useState(false)
  const [orgSlug, setOrgSlug] = useState<string | null>(null)

  useEffect(() => {
    apiFetch('crm', '/whatsapp-config')
      .then(r => r.json() as Promise<any>)
      .then(data => {
        if (data) {
          setApiToken(data.api_token_encrypted === '••••••••' ? '••••••••' : '')
          setHasToken(data.api_token_encrypted === '••••••••')
          setWebhookSecret(data.webhook_secret ?? '')
          setWelcomeTemplate(data.welcome_template ?? welcomeTemplate)
          setBotEnabled(data.bot_enabled ?? true)
          setNotifyAgent(data.notify_agent_email ?? true)
          setNotifyAdmin(data.notify_admin_email ?? true)
          if (data.org_slug) setOrgSlug(data.org_slug)
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      const body: Record<string, unknown> = {
        provider: 'callbell',
        welcome_template: welcomeTemplate,
        bot_enabled: botEnabled,
        notify_agent_email: notifyAgent,
        notify_admin_email: notifyAdmin,
      }
      if (apiToken && apiToken !== '••••••••') body.api_token = apiToken
      if (webhookSecret) body.webhook_secret = webhookSecret

      const res = await apiFetch('crm', '/whatsapp-config', {
        method: 'PUT',
        body: JSON.stringify(body),
      })
      const data = (await res.json()) as any
      if (data.error) {
        toast(data.error, 'error')
      } else {
        toast('Configuración guardada')
        setHasToken(true)
        if (!webhookSecret) {
          const fresh = await apiFetch('crm', '/whatsapp-config').then(r => r.json() as Promise<any>)
          if (fresh?.webhook_secret) setWebhookSecret(fresh.webhook_secret)
        }
      }
    } catch { toast('Error al guardar', 'error') }
    setSaving(false)
  }

  const handleTest = async () => {
    if (!testPhone) { toast('Ingresá un número de teléfono', 'error'); return }
    setTesting(true)
    try {
      const res = await apiFetch('crm', '/whatsapp-config/test', {
        method: 'POST',
        body: JSON.stringify({ phone: testPhone }),
      })
      const data = (await res.json()) as any
      if (data.status === 'sent') toast('Mensaje de prueba enviado!')
      else toast(data.error ?? 'Error al enviar', 'error')
    } catch { toast('Error al enviar', 'error') }
    setTesting(false)
  }

  const copyWebhookUrl = () => {
    const url = `https://public.api.vendepro.com.ar/webhooks/callbell`
    navigator.clipboard.writeText(url)
    toast('URL copiada al portapapeles')
  }

  if (!isAdmin) {
    return (
      <div className="text-center py-20 text-gray-500">
        Solo administradores pueden acceder a esta configuración.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/configuracion" className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 mb-2">
          <ArrowLeft className="w-3 h-3" /> Configuración
        </Link>
        <h1 className="text-xl sm:text-2xl font-semibold text-gray-800 flex items-center gap-2">
          <MessageCircle className="w-6 h-6 text-green-600" /> WhatsApp Bot
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Auto-respuesta y calificación automática de leads por WhatsApp
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : (
        <>
          {/* Callbell API */}
          <div className="bg-white rounded-xl border p-6">
            <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <MessageCircle className="w-4 h-4 text-green-600" /> Conexión Callbell
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              Conectá tu cuenta de{' '}
              <a href="https://www.callbell.eu" target="_blank" rel="noopener noreferrer" className="text-green-600 underline">
                Callbell
              </a>
              {' '}para enviar y recibir mensajes de WhatsApp automáticamente.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">API Token</label>
                <input
                  type="password"
                  value={apiToken}
                  onChange={e => setApiToken(e.target.value)}
                  placeholder={hasToken ? '••••••••' : 'Pegá tu Callbell API token'}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Lo encontrás en Callbell → Configuración → API
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Webhook URL (para Callbell)</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value="https://public.api.vendepro.com.ar/webhooks/callbell"
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-2.5 text-sm bg-gray-50 text-gray-600 font-mono text-xs"
                  />
                  <button
                    onClick={copyWebhookUrl}
                    className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-600"
                    title="Copiar URL"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  Configurá esta URL como webhook en Callbell → Configuración → Webhooks
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Webhook Secret</label>
                <input
                  type="text"
                  value={webhookSecret}
                  onChange={e => setWebhookSecret(e.target.value)}
                  placeholder="Se genera automáticamente al guardar"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm font-mono text-xs focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Usá este valor como header <code className="bg-gray-100 px-1 rounded">X-Webhook-Secret</code> en Callbell
                </p>
              </div>
            </div>
          </div>

          {/* Bot de calificación */}
          <div className="bg-white rounded-xl border p-6">
            <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Bot className="w-4 h-4 text-purple-600" /> Bot de calificación
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              Cuando entra un lead, el bot le envía un mensaje de bienvenida y le hace preguntas
              para calificarlo automáticamente (tipo de operación, zona, presupuesto).
            </p>

            <div className="space-y-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <div className={`relative w-11 h-6 rounded-full transition-colors ${botEnabled ? 'bg-green-500' : 'bg-gray-300'}`}>
                  <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${botEnabled ? 'translate-x-5' : ''}`} />
                </div>
                <input type="checkbox" className="sr-only" checked={botEnabled} onChange={e => setBotEnabled(e.target.checked)} />
                <span className="text-sm font-medium text-gray-700">Bot activo</span>
              </label>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mensaje de bienvenida</label>
                <textarea
                  value={welcomeTemplate}
                  onChange={e => setWelcomeTemplate(e.target.value)}
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500 resize-none"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Usá <code className="bg-gray-100 px-1 rounded">{'{{name}}'}</code> para insertar el nombre del lead
                </p>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-xs font-medium text-gray-600 mb-2">Flujo del bot:</p>
                <div className="flex items-center gap-2 text-xs text-gray-500 flex-wrap">
                  <span className="bg-green-100 text-green-700 px-2 py-1 rounded">1. Bienvenida + ¿Comprás o vendés?</span>
                  <span>→</span>
                  <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded">2. ¿Qué zona?</span>
                  <span>→</span>
                  <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded">3. ¿Presupuesto?</span>
                  <span>→</span>
                  <span className="bg-pink-100 text-pink-700 px-2 py-1 rounded">4. Deriva a agente</span>
                </div>
              </div>
            </div>
          </div>

          {/* Notificaciones internas */}
          <div className="bg-white rounded-xl border p-6">
            <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Bell className="w-4 h-4 text-amber-500" /> Notificaciones internas
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              Cuando entra un lead nuevo, ¿a quién notificamos por email?
            </p>

            <div className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <div className={`relative w-11 h-6 rounded-full transition-colors ${notifyAgent ? 'bg-green-500' : 'bg-gray-300'}`}>
                  <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${notifyAgent ? 'translate-x-5' : ''}`} />
                </div>
                <input type="checkbox" className="sr-only" checked={notifyAgent} onChange={e => setNotifyAgent(e.target.checked)} />
                <span className="text-sm text-gray-700">Email al agente asignado</span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <div className={`relative w-11 h-6 rounded-full transition-colors ${notifyAdmin ? 'bg-green-500' : 'bg-gray-300'}`}>
                  <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${notifyAdmin ? 'translate-x-5' : ''}`} />
                </div>
                <input type="checkbox" className="sr-only" checked={notifyAdmin} onChange={e => setNotifyAdmin(e.target.checked)} />
                <span className="text-sm text-gray-700">Email al administrador</span>
              </label>
            </div>
          </div>

          {/* Acciones */}
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center justify-center gap-2 bg-green-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Guardar configuración
            </button>
          </div>

          {/* Prueba */}
          {hasToken && (
            <div className="bg-white rounded-xl border p-6">
              <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <Send className="w-4 h-4 text-blue-500" /> Enviar mensaje de prueba
              </h2>
              <div className="flex gap-3">
                <input
                  type="tel"
                  value={testPhone}
                  onChange={e => setTestPhone(e.target.value)}
                  placeholder="+5491112345678"
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500"
                />
                <button
                  onClick={handleTest}
                  disabled={testing}
                  className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Enviar
                </button>
              </div>
            </div>
          )}

          {/* Widget embed */}
          {orgSlug && (
            <div className="bg-white rounded-xl border p-6">
              <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <Code className="w-4 h-4 text-indigo-500" /> Widget para tu web
              </h2>
              <p className="text-sm text-gray-500 mb-4">
                Pegá este código en tu sitio web para mostrar el chat de calificación automática.
                Los visitantes podrán chatear y sus datos se cargan como leads en el CRM.
              </p>
              <div className="relative">
                <pre className="bg-gray-900 text-green-400 rounded-lg p-4 text-xs font-mono overflow-x-auto whitespace-pre-wrap">
{`<script src="https://app.vendepro.com.ar/widget-embed.js" data-slug="${orgSlug}"></script>`}
                </pre>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(`<script src="https://app.vendepro.com.ar/widget-embed.js" data-slug="${orgSlug}"></script>`)
                    toast('Código copiado al portapapeles')
                  }}
                  className="absolute top-2 right-2 p-1.5 bg-gray-700 hover:bg-gray-600 rounded text-gray-300"
                  title="Copiar código"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-2">
                Agregalo antes del cierre <code className="bg-gray-100 px-1 rounded">&lt;/body&gt;</code> de tu sitio
              </p>
            </div>
          )}

          {/* Setup guide */}
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border border-green-200 p-6">
            <h2 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-600" /> Guía de configuración
            </h2>
            <ol className="space-y-2 text-sm text-gray-600">
              <li className="flex gap-2">
                <span className="font-semibold text-green-700">1.</span>
                Creá una cuenta en <a href="https://www.callbell.eu" target="_blank" rel="noopener noreferrer" className="text-green-600 underline">callbell.eu</a> y conectá tu número de WhatsApp Business
              </li>
              <li className="flex gap-2">
                <span className="font-semibold text-green-700">2.</span>
                En Callbell → Configuración → API, copiá el API Token y pegalo arriba
              </li>
              <li className="flex gap-2">
                <span className="font-semibold text-green-700">3.</span>
                En Callbell → Configuración → Webhooks, configurá la URL de webhook y el secret
              </li>
              <li className="flex gap-2">
                <span className="font-semibold text-green-700">4.</span>
                Guardá la configuración y enviá un mensaje de prueba
              </li>
            </ol>
          </div>
        </>
      )}
    </div>
  )
}
