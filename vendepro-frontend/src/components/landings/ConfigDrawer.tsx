'use client'
import { useState } from 'react'
import { X, Save } from 'lucide-react'
import { landingsApi } from '@/lib/landings/api'
import { slugifyBase, isValidSlugBase } from '@/lib/landings/slug'
import type { Landing } from '@/lib/landings/types'

export default function ConfigDrawer({
  landing,
  onClose,
  onSaved,
}: {
  landing: Landing
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const [slugBase, setSlugBase] = useState(landing.slug_base)
  const [brandVoice, setBrandVoice] = useState(landing.brand_voice ?? '')
  const [seoTitle, setSeoTitle] = useState(landing.seo_title ?? '')
  const [seoDesc, setSeoDesc] = useState(landing.seo_description ?? '')
  const [ogImage, setOgImage] = useState(landing.og_image_url ?? '')
  const [leadRulesJson, setLeadRulesJson] = useState(
    JSON.stringify(landing.lead_rules ?? {}, null, 2)
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    const normSlug = slugifyBase(slugBase)
    if (!isValidSlugBase(normSlug)) {
      setError('Slug inválido')
      return
    }
    let leadRules
    try {
      leadRules = leadRulesJson.trim() ? JSON.parse(leadRulesJson) : null
    } catch {
      setError('Lead rules JSON inválido')
      return
    }

    setSaving(true)
    setError(null)
    try {
      await landingsApi.updateMetadata(landing.id, {
        slug_base: normSlug !== landing.slug_base ? normSlug : (undefined as any),
        brand_voice: brandVoice || null,
        seo_title: seoTitle || null,
        seo_description: seoDesc || null,
        og_image_url: ogImage || null,
        lead_rules: leadRules,
      })
      await onSaved()
      onClose()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose}>
      <aside
        className="absolute right-0 top-0 h-full w-[460px] bg-white shadow-xl flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="font-semibold text-gray-900">Configuración</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-auto p-4 space-y-4">
          <div>
            <label className="block text-xs uppercase tracking-wider font-semibold text-gray-500 mb-1">
              Slug
            </label>
            <input
              value={slugBase}
              onChange={e => setSlugBase(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            />
            <p className="text-xs text-gray-500 mt-1">
              URL:{' '}
              <code>
                {slugifyBase(slugBase)}-{landing.slug_suffix}.landings.vendepro.com.ar
              </code>
            </p>
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wider font-semibold text-gray-500 mb-1">
              Brand voice (para la IA)
            </label>
            <textarea
              value={brandVoice}
              onChange={e => setBrandVoice(e.target.value)}
              maxLength={300}
              placeholder="ej: cálido, cercano, profesional"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-y min-h-[80px]"
            />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wider font-semibold text-gray-500 mb-1">
              SEO Title
            </label>
            <input
              value={seoTitle}
              onChange={e => setSeoTitle(e.target.value)}
              maxLength={60}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wider font-semibold text-gray-500 mb-1">
              SEO Description
            </label>
            <textarea
              value={seoDesc}
              onChange={e => setSeoDesc(e.target.value)}
              maxLength={160}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wider font-semibold text-gray-500 mb-1">
              OG Image URL
            </label>
            <input
              value={ogImage}
              onChange={e => setOgImage(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wider font-semibold text-gray-500 mb-1">
              Lead rules (JSON)
            </label>
            <textarea
              value={leadRulesJson}
              onChange={e => setLeadRulesJson(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs font-mono resize-y min-h-[120px]"
            />
            <p className="text-xs text-gray-500 mt-1">
              Ej:{' '}
              <code>
                {'{"assigned_agent_id":"u_123","tags":["palermo"],"campaign":"Q2","notify_channels":["email"]}'}
              </code>
            </p>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <div className="p-4 border-t border-gray-200">
          <button
            onClick={save}
            disabled={saving}
            className="w-full inline-flex items-center justify-center gap-2 bg-[#ff007c] hover:bg-[#e60070] text-white font-semibold py-2.5 rounded-full disabled:opacity-60"
          >
            <Save className="w-4 h-4" /> {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </aside>
    </div>
  )
}
