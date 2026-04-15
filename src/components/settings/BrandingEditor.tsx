'use client'

import { useState, useEffect, useRef } from 'react'
import { Upload, Loader2, Check } from 'lucide-react'

export default function BrandingEditor() {
  const [branding, setBranding] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/org-branding').then(r => r.json()).then(data => {
      setBranding(data)
      setLoading(false)
    })
  }, [])

  async function saveColors() {
    setSaving(true)
    await fetch('/api/org-branding', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        brand_color: branding.brand_color,
        brand_accent_color: branding.brand_accent_color,
      }),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  async function uploadLogo(file: File) {
    setUploading(true)
    const form = new FormData()
    form.append('logo', file)
    const res = await fetch('/api/org-branding', { method: 'PUT', body: form })
    const data = (await res.json()) as any
    if (data.logo_url) setBranding((b: any) => ({ ...b, logo_url: data.logo_url }))
    setUploading(false)
  }

  if (loading) return <div className="animate-pulse h-40 bg-gray-100 rounded-xl" />

  return (
    <div className="space-y-6">
      {/* Logo */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Logo de la inmobiliaria</label>
        <div className="flex items-center gap-4">
          <div className="w-24 h-24 bg-gray-100 rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden">
            {branding.logo_url ? (
              <img src={branding.logo_url} alt="Logo" className="w-full h-full object-contain p-2" />
            ) : (
              <Upload className="w-6 h-6 text-gray-400" />
            )}
          </div>
          <div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => {
              const f = e.target.files?.[0]
              if (f) uploadLogo(f)
            }} />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium text-gray-700 disabled:opacity-50"
            >
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Cambiar logo'}
            </button>
            <p className="text-xs text-gray-400 mt-1">PNG o JPG, se mostrará en la página de tasación</p>
          </div>
        </div>
      </div>

      {/* Colors */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Color primario</label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={branding.brand_color || '#ff007c'}
              onChange={e => setBranding((b: any) => ({ ...b, brand_color: e.target.value }))}
              className="w-10 h-10 rounded-lg cursor-pointer border border-gray-200"
            />
            <input
              type="text"
              value={branding.brand_color || '#ff007c'}
              onChange={e => setBranding((b: any) => ({ ...b, brand_color: e.target.value }))}
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Color acento</label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={branding.brand_accent_color || '#ff8017'}
              onChange={e => setBranding((b: any) => ({ ...b, brand_accent_color: e.target.value }))}
              className="w-10 h-10 rounded-lg cursor-pointer border border-gray-200"
            />
            <input
              type="text"
              value={branding.brand_accent_color || '#ff8017'}
              onChange={e => setBranding((b: any) => ({ ...b, brand_accent_color: e.target.value }))}
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono"
            />
          </div>
        </div>
      </div>

      {/* Gradient preview */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Vista previa del gradiente</label>
        <div
          className="h-12 rounded-xl"
          style={{ background: `linear-gradient(to right, ${branding.brand_color || '#ff007c'}, ${branding.brand_accent_color || '#ff8017'})` }}
        />
      </div>

      <button
        onClick={saveColors}
        disabled={saving}
        className="px-6 py-2.5 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50 flex items-center gap-2"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <><Check className="w-4 h-4" /> Guardado</> : 'Guardar colores'}
      </button>
    </div>
  )
}
