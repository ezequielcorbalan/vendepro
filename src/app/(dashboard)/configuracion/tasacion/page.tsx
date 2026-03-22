'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft, Save, Loader2, Video, FileText, Phone } from 'lucide-react'

const settingFields = [
  { key: 'tasacion_video_comercial', label: 'Video propuesta comercial', placeholder: 'https://www.youtube.com/embed/...', type: 'url', icon: Video, group: 'Videos' },
  { key: 'tasacion_video_mercado', label: 'Video situación de mercado', placeholder: 'https://www.youtube.com/embed/...', type: 'url', icon: Video, group: 'Videos' },
  { key: 'tasacion_texto_comercial', label: 'Texto propuesta comercial', placeholder: 'Explicación de las 4 condiciones para vender al mejor valor...', type: 'textarea', icon: FileText, group: 'Textos' },
  { key: 'tasacion_texto_servicios', label: 'Qué hacemos para vender', placeholder: 'Fotografía profesional HDR, amoblamiento virtual, video 360...', type: 'textarea', icon: FileText, group: 'Textos' },
  { key: 'tasacion_texto_embudo', label: 'Texto embudo de ventas', placeholder: 'Explicación de cómo funciona el embudo y la probabilidad de venta...', type: 'textarea', icon: FileText, group: 'Textos' },
  { key: 'tasacion_texto_reportes', label: 'Texto seguimiento quincenal', placeholder: 'Nos enfocamos en mantener una cartera que nos permita medir...', type: 'textarea', icon: FileText, group: 'Textos' },
  { key: 'tasacion_datos_props_publicadas', label: 'Propiedades en venta (CABA)', placeholder: '110953', type: 'number', icon: FileText, group: 'Datos mercado' },
  { key: 'tasacion_datos_vendidas_mes', label: 'Propiedades vendidas por mes', placeholder: '6998', type: 'number', icon: FileText, group: 'Datos mercado' },
  { key: 'tasacion_datos_mes_referencia', label: 'Mes de referencia del dato', placeholder: 'Marzo 2026', type: 'text', icon: FileText, group: 'Datos mercado' },
  { key: 'tasacion_datos_escrituras_mes', label: 'Escrituras por mes (CABA)', placeholder: '6998', type: 'number', icon: FileText, group: 'Datos mercado' },
  { key: 'tasacion_texto_condiciones', label: 'Condiciones de trabajo', placeholder: 'Honorarios 3%, exclusiva 120 días...', type: 'textarea', icon: FileText, group: 'Condiciones' },
  { key: 'tasacion_cta_calendly', label: 'Link agendar reunión', placeholder: 'https://calendly.com/...', type: 'url', icon: Phone, group: 'Call to Action' },
  { key: 'tasacion_cta_whatsapp', label: 'Número WhatsApp', placeholder: '5491158874005', type: 'text', icon: Phone, group: 'Call to Action' },
]

export default function TasacionConfigPage() {
  const [settings, setSettings] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetch('/api/org-settings')
      .then(r => r.json())
      .then((data: any) => { setSettings(data as Record<string, string>); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  async function handleSave() {
    setSaving(true)
    setSaved(false)
    await fetch('/api/org-settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  if (loading) return <div className="flex items-center gap-2 text-brand-gray"><Loader2 className="w-5 h-5 animate-spin" /> Cargando configuración...</div>

  const groups = [...new Set(settingFields.map(f => f.group))]

  return (
    <div className="max-w-3xl">
      <Link href="/configuracion" className="inline-flex items-center gap-2 text-sm text-brand-gray hover:text-gray-800 mb-6">
        <ArrowLeft className="w-4 h-4" /> Volver a configuración
      </Link>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-800">Configuración de tasaciones</h1>
          <p className="text-sm text-brand-gray mt-1">Contenido fijo que se muestra en todas las landings de tasación</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 bg-brand-pink text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? 'Guardando...' : saved ? '¡Guardado!' : 'Guardar'}
        </button>
      </div>

      <div className="space-y-6">
        {groups.map(group => (
          <div key={group} className="bg-white rounded-xl shadow-sm p-4 sm:p-6">
            <h2 className="text-base font-semibold text-gray-800 mb-4">{group}</h2>
            <div className="space-y-4">
              {settingFields.filter(f => f.group === group).map(field => (
                <div key={field.key}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{field.label}</label>
                  {field.type === 'textarea' ? (
                    <textarea
                      value={settings[field.key] || ''}
                      onChange={(e) => setSettings(prev => ({ ...prev, [field.key]: e.target.value }))}
                      placeholder={field.placeholder}
                      rows={4}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-pink/50"
                    />
                  ) : (
                    <input
                      type={field.type === 'number' ? 'number' : 'text'}
                      value={settings[field.key] || ''}
                      onChange={(e) => setSettings(prev => ({ ...prev, [field.key]: e.target.value }))}
                      placeholder={field.placeholder}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-pink/50"
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
