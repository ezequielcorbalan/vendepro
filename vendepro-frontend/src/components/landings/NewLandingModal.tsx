'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { X, ChevronRight, Loader2 } from 'lucide-react'
import { templatesApi, landingsApi } from '@/lib/landings/api'
import type { LandingTemplate, LandingKind } from '@/lib/landings/types'
import { slugifyBase, isValidSlugBase, publicLandingHostPath } from '@/lib/landings/slug'

type Step = 'template' | 'name'

export default function NewLandingModal({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const [step, setStep] = useState<Step>('template')
  const [templates, setTemplates] = useState<LandingTemplate[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<LandingTemplate | null>(null)
  const [kindFilter, setKindFilter] = useState<LandingKind | 'all'>('all')
  const [loading, setLoading] = useState(true)
  const [slugBase, setSlugBase] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    templatesApi.list().then(r => setTemplates(r.templates)).finally(() => setLoading(false))
  }, [])

  const filtered = kindFilter === 'all' ? templates : templates.filter(t => t.kind === kindFilter)

  async function submit() {
    if (!selectedTemplate) return
    const normalized = slugifyBase(slugBase)
    if (!isValidSlugBase(normalized)) {
      setError('El slug debe tener 3-60 caracteres, solo letras, números y guiones.')
      return
    }
    setCreating(true); setError(null)
    try {
      const r = await landingsApi.create({ templateId: selectedTemplate.id, slugBase: normalized })
      router.push(`/landings/${r.landingId}`)
    } catch (e: any) {
      setError(e.message ?? 'No se pudo crear la landing.')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-xl flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Nueva landing</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex items-center gap-3 px-6 py-3 border-b border-gray-100 text-sm">
          <span className={`font-medium ${step === 'template' ? 'text-[#ff007c]' : 'text-gray-400'}`}>1. Elegí un template</span>
          <ChevronRight className="w-4 h-4 text-gray-300" />
          <span className={`font-medium ${step === 'name' ? 'text-[#ff007c]' : 'text-gray-400'}`}>2. Nombrala</span>
        </div>

        {step === 'template' && (
          <div className="flex-1 overflow-auto p-6">
            <div className="flex gap-2 mb-4">
              {(['all', 'lead_capture', 'property'] as const).map(k => (
                <button key={k} onClick={() => setKindFilter(k)} className={`px-3 py-1.5 rounded-full text-sm ${kindFilter === k ? 'bg-[#ff007c] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                  {k === 'all' ? 'Todos' : k === 'lead_capture' ? 'Captación' : 'Propiedad'}
                </button>
              ))}
            </div>
            {loading ? (
              <div className="text-center py-12 text-gray-500">Cargando templates…</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {filtered.map(t => (
                  <button key={t.id} onClick={() => { setSelectedTemplate(t); setStep('name') }}
                    className="text-left bg-white border border-gray-200 hover:border-[#ff007c] rounded-2xl overflow-hidden transition-colors">
                    <div className="aspect-[16/10] bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center text-gray-400">
                      {t.preview_image_url ? <img src={t.preview_image_url} alt="" className="w-full h-full object-cover" /> : <span className="text-xs">Sin preview</span>}
                    </div>
                    <div className="p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs px-2 py-0.5 rounded-md bg-gray-100 text-gray-600">{t.kind === 'lead_capture' ? 'Captación' : 'Propiedad'}</span>
                      </div>
                      <h3 className="font-semibold text-gray-900 mb-1">{t.name}</h3>
                      {t.description && <p className="text-sm text-gray-600 line-clamp-2">{t.description}</p>}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {step === 'name' && selectedTemplate && (
          <div className="flex-1 overflow-auto p-6">
            <p className="text-sm text-gray-500 mb-6">Template elegido: <strong className="text-gray-900">{selectedTemplate.name}</strong></p>

            <label className="block text-sm font-medium text-gray-700 mb-2">Nombre / slug de la landing</label>
            <input
              autoFocus
              value={slugBase}
              onChange={e => setSlugBase(e.target.value)}
              placeholder="ej: palermo-soho"
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 focus:outline-none focus:border-[#ff007c]"
            />
            {slugBase && (
              <p className="mt-2 text-xs text-gray-500">
                URL final: <code>{publicLandingHostPath(`${slugifyBase(slugBase) || 'slug'}-XXXXX`)}</code> (se agrega un sufijo aleatorio de 5 chars)
              </p>
            )}
            {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

            <div className="flex items-center justify-between mt-8">
              <button onClick={() => setStep('template')} className="text-sm text-gray-600 hover:text-gray-900">← Volver</button>
              <button onClick={submit} disabled={creating || !slugBase.trim()}
                className="inline-flex items-center gap-2 bg-[#ff007c] hover:bg-[#e60070] text-white font-semibold px-6 py-2.5 rounded-full disabled:opacity-60">
                {creating ? <><Loader2 className="w-4 h-4 animate-spin" />Creando…</> : 'Crear landing'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
