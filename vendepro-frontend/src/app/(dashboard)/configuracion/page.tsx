'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { Settings, Save, Loader2, Building2, Palette, Link2, CheckCircle, XCircle } from 'lucide-react'
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

  useEffect(() => {
    Promise.all([
      apiFetch('admin', '/org-settings').then(r => r.json() as Promise<any>),
    ]).then(([data]) => {
      if (data.settings) setSettings(data.settings)
      if (data.org) setOrg(data.org)
      if (data.slug) setSlug(data.slug)
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
    </div>
  )
}
