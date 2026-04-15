'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft, Save, Loader2, Palette, LayoutGrid, BarChart3, Phone } from 'lucide-react'
import BrandingEditor from '@/components/settings/BrandingEditor'
import TasacionBlocksEditor from '@/components/settings/TasacionBlocksEditor'

const scalarFields = [
  { key: 'tasacion_datos_props_publicadas', label: 'Propiedades en venta (CABA)', placeholder: '110953', type: 'number', group: 'Datos mercado' },
  { key: 'tasacion_datos_vendidas_mes', label: 'Propiedades vendidas por mes', placeholder: '6998', type: 'number', group: 'Datos mercado' },
  { key: 'tasacion_datos_mes_referencia', label: 'Mes de referencia del dato', placeholder: 'Marzo 2026', type: 'text', group: 'Datos mercado' },
  { key: 'tasacion_datos_escrituras_mes', label: 'Escrituras por mes (CABA)', placeholder: '6998', type: 'number', group: 'Datos mercado' },
  { key: 'tasacion_cta_calendly', label: 'Link agendar reunión', placeholder: 'https://calendly.com/...', type: 'url', group: 'Call to Action' },
  { key: 'tasacion_cta_whatsapp', label: 'Número WhatsApp', placeholder: '5491158874005', type: 'text', group: 'Call to Action' },
]

type Tab = 'branding' | 'blocks' | 'data'

export default function TasacionConfigPage() {
  const [tab, setTab] = useState<Tab>('blocks')
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

  async function handleSaveSettings() {
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

  const tabs: { id: Tab; label: string; icon: any }[] = [
    { id: 'blocks', label: 'Bloques', icon: LayoutGrid },
    { id: 'branding', label: 'Marca', icon: Palette },
    { id: 'data', label: 'Datos y CTAs', icon: BarChart3 },
  ]

  return (
    <div className="max-w-3xl">
      <Link href="/configuracion" className="inline-flex items-center gap-2 text-sm text-brand-gray hover:text-gray-800 mb-6">
        <ArrowLeft className="w-4 h-4" /> Volver a configuración
      </Link>

      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-semibold text-gray-800">Configuración de tasaciones</h1>
        <p className="text-sm text-brand-gray mt-1">Template de la landing page de tasación</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-6">
        {tabs.map(t => {
          const Icon = t.icon
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                tab === t.id
                  ? 'bg-white text-gray-800 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Icon className="w-4 h-4" /> {t.label}
            </button>
          )
        })}
      </div>

      {/* Branding tab */}
      {tab === 'branding' && (
        <div className="bg-white rounded-xl shadow-sm p-5 sm:p-6">
          <h2 className="text-base font-semibold text-gray-800 mb-4">Identidad visual</h2>
          <p className="text-sm text-gray-500 mb-6">Logo y colores que se aplican a todas las landings de tasación de tu inmobiliaria.</p>
          <BrandingEditor />
        </div>
      )}

      {/* Blocks tab */}
      {tab === 'blocks' && (
        <div className="bg-white rounded-xl shadow-sm p-5 sm:p-6">
          <h2 className="text-base font-semibold text-gray-800 mb-1">Bloques del template</h2>
          <p className="text-sm text-gray-500 mb-6">Secciones que se muestran en la página de tasación. Podés agregar, quitar, editar y reordenar.</p>
          <TasacionBlocksEditor />
        </div>
      )}

      {/* Data & CTAs tab */}
      {tab === 'data' && (
        <div className="space-y-6">
          {loading ? (
            <div className="flex items-center gap-2 text-brand-gray"><Loader2 className="w-5 h-5 animate-spin" /> Cargando...</div>
          ) : (
            <>
              {['Datos mercado', 'Call to Action'].map(group => (
                <div key={group} className="bg-white rounded-xl shadow-sm p-5 sm:p-6">
                  <h2 className="text-base font-semibold text-gray-800 mb-4">{group}</h2>
                  <div className="space-y-4">
                    {scalarFields.filter(f => f.group === group).map(field => (
                      <div key={field.key}>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{field.label}</label>
                        <input
                          type={field.type === 'number' ? 'number' : 'text'}
                          value={settings[field.key] || ''}
                          onChange={e => setSettings(prev => ({ ...prev, [field.key]: e.target.value }))}
                          placeholder={field.placeholder}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-pink/50"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              <button
                onClick={handleSaveSettings}
                disabled={saving}
                className="inline-flex items-center gap-2 bg-brand-pink text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {saving ? 'Guardando...' : saved ? '¡Guardado!' : 'Guardar datos'}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
