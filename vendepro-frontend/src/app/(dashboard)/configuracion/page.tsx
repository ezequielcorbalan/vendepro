'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { Settings, Save, Loader2, Building2, Palette, Link2, CheckCircle, XCircle, Key, Copy, RefreshCw, CheckCircle2 } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'

export default function ConfiguracionPage() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [settings, setSettings] = useState<Record<string, string>>({})
  const [org, setOrg] = useState<any>(null)
  const [slug, setSlug] = useState('')
  const slugDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [slugStatus, setSlugStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle')
  const [apiKeyData, setApiKeyData] = useState<{ has_key: boolean; api_key_masked: string | null } | null>(null)
  const [newApiKey, setNewApiKey] = useState<string | null>(null)
  const [generatingKey, setGeneratingKey] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    Promise.all([
      apiFetch('admin', '/org-settings').then(r => r.json() as Promise<any>),
      apiFetch('crm', '/api-key').then(r => r.json() as Promise<any>).catch(() => null),
    ]).then(([data, keyData]) => {
      if (data.settings) setSettings(data.settings)
      if (data.org) setOrg(data.org)
      if (data.slug) setSlug(data.slug)
      if (keyData) setApiKeyData(keyData)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!slug) { setSlugStatus('idle'); return }
    if (slugDebounceRef.current) clearTimeout(slugDebounceRef.current)
    setSlugStatus('checking')
    slugDebounceRef.current = setTimeout(async () => {
      try {
        const res = await apiFetch('auth', `/check-slug?slug=${encodeURIComponent(slug)}`)
        const data = (await res.json()) as any
        if (data.slug) setSlug(data.slug)
        setSlugStatus(data.available ? 'available' : 'taken')
      } catch {
        setSlugStatus('idle')
      }
    }, 500)
  }, [slug])

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await apiFetch('admin', '/org-settings', {
        method: 'PUT',
        body: JSON.stringify({ settings, slug }),
      })
      const data = (await res.json()) as any
      if (data.error) toast(data.error, 'error')
      else toast('Configuración guardada')
    } catch { toast('Error al guardar', 'error') }
    setSaving(false)
  }

  const handleGenerateApiKey = async (isRegenerate = false) => {
    if (isRegenerate && !confirm('¿Regenerar la API key? La key anterior dejará de funcionar.')) return
    setGeneratingKey(true)
    try {
      const res = await apiFetch('crm', '/api-key', { method: 'POST' })
      const data = (await res.json()) as any
      if (data.api_key) {
        setNewApiKey(data.api_key)
        setApiKeyData({ has_key: true, api_key_masked: `vp_live_••••••••••••${data.api_key.slice(-4)}` })
        toast('API key generada — copiala ahora, no se mostrará completa nuevamente')
      }
    } catch { toast('Error al generar API key', 'error') }
    setGeneratingKey(false)
  }

  const handleCopyKey = (key: string) => {
    navigator.clipboard.writeText(key).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  function setSetting(key: string, value: string) {
    setSettings(prev => ({ ...prev, [key]: value }))
  }

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-800">Configuración</h1>
          <p className="text-gray-500 text-sm mt-1">Configuración de la organización</p>
        </div>
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 bg-[#ff007c] text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Guardar
        </button>
      </div>

      {/* Org info */}
      {org && (
        <div className="bg-white rounded-xl border p-6">
          <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-[#ff007c]" /> Organización
          </h2>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
              <input type="text" value={org.name || ''} disabled className="w-full border rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-400" />
            </div>
            {/* Slug */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Identificador único (URL)
                <span className="text-gray-400 font-normal ml-1 text-xs">— aparece en links públicos</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={slug}
                  onChange={e => setSlug(e.target.value)}
                  placeholder="mi-inmobiliaria"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff007c]/50 focus:border-[#ff007c] pr-8"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {slugStatus === 'checking' && <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />}
                  {slugStatus === 'available' && <CheckCircle className="w-4 h-4 text-green-500" />}
                  {slugStatus === 'taken' && <XCircle className="w-4 h-4 text-red-500" />}
                </div>
              </div>
              {slugStatus === 'taken' && <p className="text-xs text-red-600 mt-1">Ya está en uso</p>}
            </div>
            {org.logo_url && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Logo</label>
                <img src={org.logo_url} alt="Logo" className="h-12 object-contain" />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Brand settings */}
      <div className="bg-white rounded-xl border p-6">
        <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <Palette className="w-4 h-4 text-[#ff007c]" /> Marca y comunicación
        </h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp de contacto</label>
            <input
              type="tel"
              value={settings.contact_whatsapp || ''}
              onChange={e => setSetting('contact_whatsapp', e.target.value)}
              placeholder="+54 9 11 1234-5678"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#ff007c]/50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono de oficina</label>
            <input
              type="tel"
              value={settings.contact_phone || ''}
              onChange={e => setSetting('contact_phone', e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#ff007c]/50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email de contacto</label>
            <input
              type="email"
              value={settings.contact_email || ''}
              onChange={e => setSetting('contact_email', e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#ff007c]/50"
            />
          </div>
        </div>
      </div>

      {/* Links */}
      <div className="bg-white rounded-xl border p-6">
        <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <Link2 className="w-4 h-4 text-[#ff007c]" /> Integraciones
        </h2>
        <div className="space-y-3">
          <Link href="/configuracion/tasacion" className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
            <span className="text-sm font-medium text-gray-700">Bloques de tasación</span>
            <span className="text-xs text-[#ff007c]">Configurar →</span>
          </Link>
          <Link href="/configuracion/perfil" className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
            <span className="text-sm font-medium text-gray-700">Perfil de agente</span>
            <span className="text-xs text-[#ff007c]">Configurar →</span>
          </Link>
        </div>
      </div>

      {/* Integración web */}
      <div className="bg-white rounded-xl border p-6">
        <h2 className="font-semibold text-gray-800 mb-1 flex items-center gap-2">
          <Key className="w-4 h-4 text-[#ff007c]" /> Integración web
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          Recibí leads automáticamente desde tu sitio web usando tu API key.
        </p>

        {/* Gestión de API key */}
        <div className="border rounded-lg p-4 mb-4 bg-gray-50">
          <p className="text-sm font-medium text-gray-700 mb-3">API Key</p>

          {newApiKey && (
            <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-xs text-amber-700 mb-2 font-medium">Copiá esta key — no se mostrará nuevamente:</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs font-mono bg-white border rounded px-2 py-1 truncate">{newApiKey}</code>
                <button
                  onClick={() => handleCopyKey(newApiKey)}
                  className="shrink-0 flex items-center gap-1 px-2 py-1 text-xs bg-[#ff007c] text-white rounded hover:opacity-90"
                >
                  {copied ? <CheckCircle2 className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  {copied ? 'Copiado' : 'Copiar'}
                </button>
              </div>
            </div>
          )}

          {apiKeyData?.has_key ? (
            <div className="flex items-center gap-2">
              <code className="flex-1 text-sm font-mono bg-white border rounded px-3 py-2 text-gray-600">
                {apiKeyData.api_key_masked}
              </code>
              <button
                onClick={() => handleGenerateApiKey(true)}
                disabled={generatingKey}
                className="shrink-0 flex items-center gap-1 px-3 py-2 text-sm border rounded-lg hover:bg-gray-100 disabled:opacity-50"
                title="Regenerar key"
              >
                <RefreshCw className={`w-4 h-4 ${generatingKey ? 'animate-spin' : ''}`} />
                Regenerar
              </button>
            </div>
          ) : (
            <button
              onClick={() => handleGenerateApiKey(false)}
              disabled={generatingKey}
              className="flex items-center gap-2 px-4 py-2 bg-[#ff007c] text-white rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50"
            >
              {generatingKey ? <Loader2 className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
              Generar API key
            </button>
          )}
        </div>

        {/* Snippet de código */}
        <div className="border rounded-lg overflow-hidden">
          <div className="bg-gray-800 px-4 py-2 flex items-center justify-between">
            <span className="text-xs text-gray-400 font-mono">JavaScript</span>
            <button
              onClick={() => handleCopyKey(`fetch('https://public.api.vendepro.com.ar/public/leads', {\n  method: 'POST',\n  headers: {\n    'Content-Type': 'application/json',\n    'X-API-Key': 'TU_API_KEY'\n  },\n  body: JSON.stringify({\n    full_name: 'Juan Pérez',\n    phone: '1123456789',\n    email: 'juan@email.com',\n    operation: 'venta',\n    source_detail: 'Formulario Home'\n  })\n})`)}
              className="text-xs text-gray-400 hover:text-white flex items-center gap-1"
            >
              <Copy className="w-3 h-3" /> Copiar
            </button>
          </div>
          <pre className="bg-gray-900 text-green-400 text-xs font-mono p-4 overflow-x-auto whitespace-pre">{`fetch('https://public.api.vendepro.com.ar/public/leads', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': 'TU_API_KEY'
  },
  body: JSON.stringify({
    full_name: 'Juan Pérez',      // requerido
    phone: '1123456789',          // opcional
    email: 'juan@email.com',      // opcional
    operation: 'venta',           // venta | alquiler | tasacion | otro
    source_detail: 'Formulario Home'  // texto libre
  })
})`}</pre>
        </div>

        {/* Tabla de campos */}
        <div className="mt-4 border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-600">Campo</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-600">Tipo</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-600">Requerido</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-600 hidden sm:table-cell">Descripción</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {[
                ['full_name', 'string', 'Sí', 'Nombre completo del contacto'],
                ['phone', 'string', 'No', 'Teléfono'],
                ['email', 'string', 'No', 'Email'],
                ['operation', 'string', 'No', 'venta | alquiler | tasacion | otro'],
                ['source_detail', 'string', 'No', 'Ej: "Formulario Home"'],
                ['notes', 'string', 'No', 'Notas adicionales'],
              ].map(([campo, tipo, req, desc]) => (
                <tr key={campo} className="hover:bg-gray-50">
                  <td className="px-3 py-2 font-mono text-xs text-[#ff007c]">{campo}</td>
                  <td className="px-3 py-2 text-gray-600 text-xs">{tipo}</td>
                  <td className="px-3 py-2 text-xs">{req === 'Sí' ? <span className="text-green-600 font-medium">Sí</span> : <span className="text-gray-400">No</span>}</td>
                  <td className="px-3 py-2 text-gray-500 text-xs hidden sm:table-cell">{desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
