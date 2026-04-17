'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft, Save, Loader2, Video, FileText, Phone } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { apiFetch } from '@/lib/api'

const settingFields = [
  { key: 'video_propuesta_comercial', label: 'Video propuesta comercial', placeholder: 'https://www.youtube.com/embed/...', type: 'url', icon: Video, group: 'Videos' },
  { key: 'video_situacion_mercado', label: 'Video situación de mercado', placeholder: 'https://www.youtube.com/embed/...', type: 'url', icon: Video, group: 'Videos' },
  { key: 'texto_comercial', label: 'Texto propuesta comercial', placeholder: 'Explicación de las 4 condiciones para vender al mejor valor...', type: 'textarea', icon: FileText, group: 'Textos' },
  { key: 'texto_servicios', label: 'Qué hacemos para vender', placeholder: 'Fotografía profesional HDR, amoblamiento virtual, video 360...', type: 'textarea', icon: FileText, group: 'Textos' },
  { key: 'texto_embudo', label: 'Texto embudo de ventas', placeholder: 'Explicación de cómo funciona el embudo y la probabilidad de venta...', type: 'textarea', icon: FileText, group: 'Textos' },
  { key: 'texto_reportes', label: 'Texto seguimiento quincenal', placeholder: 'Nos enfocamos en mantener una cartera que nos permita medir...', type: 'textarea', icon: FileText, group: 'Textos' },
  { key: 'datos_props_publicadas', label: 'Propiedades en venta (CABA)', placeholder: '110953', type: 'number', icon: FileText, group: 'Datos mercado' },
  { key: 'datos_vendidas_mes', label: 'Propiedades vendidas por mes', placeholder: '6998', type: 'number', icon: FileText, group: 'Datos mercado' },
  { key: 'datos_mes_referencia', label: 'Mes de referencia del dato', placeholder: 'Marzo 2026', type: 'text', icon: FileText, group: 'Datos mercado' },
  { key: 'datos_escrituras_mes', label: 'Escrituras por mes (CABA)', placeholder: '6998', type: 'number', icon: FileText, group: 'Datos mercado' },
  { key: 'texto_condiciones', label: 'Condiciones de trabajo', placeholder: 'Honorarios 3%, exclusiva 120 días...', type: 'textarea', icon: FileText, group: 'Condiciones' },
  { key: 'cta_calendly', label: 'Link agendar reunión', placeholder: 'https://calendly.com/...', type: 'url', icon: Phone, group: 'Call to Action' },
  { key: 'cta_whatsapp', label: 'Número WhatsApp', placeholder: '5491158874005', type: 'text', icon: Phone, group: 'Call to Action' },
]

const groups = [...new Set(settingFields.map(f => f.group))]

export default function MiConfigTasacionPage() {
  const { toast } = useToast()
  const [settings, setSettings] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    apiFetch('admin', '/agent-settings')
      .then(r => r.json() as Promise<any>)
      .then(d => { setSettings(d || {}); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await apiFetch('admin', '/agent-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })
      const data = (await res.json()) as any
      if (data.success) toast('Configuración guardada')
      else toast(data.error || 'Error', 'error')
    } catch { toast('Error', 'error') }
    setSaving(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-[#ff007c]" />
      </div>
    )
  }

  return (
    <div>
      <Link href="/perfil" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 mb-4">
        <ArrowLeft className="w-4 h-4" /> Volver a mi perfil
      </Link>

      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-semibold text-gray-800 flex items-center gap-2">
          <FileText className="w-6 h-6 text-[#ff007c]" /> Mi configuración de tasaciones
        </h1>
        <p className="text-sm text-gray-400 mt-1">Videos, textos, datos de mercado y CTAs que se usan en tus landings de tasación</p>
      </div>

      <div className="space-y-6">
        {groups.map(group => (
          <div key={group} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-700">{group}</h2>
            </div>
            <div className="p-5 space-y-4">
              {settingFields.filter(f => f.group === group).map(field => {
                const Icon = field.icon
                return (
                  <div key={field.key}>
                    <label className="block text-xs font-medium text-gray-600 mb-1 flex items-center gap-1.5">
                      <Icon className="w-3.5 h-3.5 text-gray-400" /> {field.label}
                    </label>
                    {field.type === 'textarea' ? (
                      <textarea
                        value={settings[field.key] || ''}
                        onChange={e => setSettings(prev => ({ ...prev, [field.key]: e.target.value }))}
                        rows={3}
                        placeholder={field.placeholder}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:ring-2 focus:ring-[#ff007c]/20 focus:border-[#ff007c]"
                      />
                    ) : (
                      <input
                        type={field.type === 'number' ? 'number' : 'text'}
                        value={settings[field.key] || ''}
                        onChange={e => setSettings(prev => ({ ...prev, [field.key]: e.target.value }))}
                        placeholder={field.placeholder}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#ff007c]/20 focus:border-[#ff007c]"
                      />
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-[#ff007c] text-white py-3 rounded-xl text-sm font-bold hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Guardar configuración
        </button>
      </div>
    </div>
  )
}
