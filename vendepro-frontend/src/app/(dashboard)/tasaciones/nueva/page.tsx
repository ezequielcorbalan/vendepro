'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Save, Loader2, Plus, Sparkles } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { PropertySelector } from '@/components/ui/PropertySelector'

const PROPERTY_TYPES = ['departamento', 'casa', 'ph', 'local', 'terreno', 'oficina']

type TasacionTemplate = { id: string; name: string; slug?: string }

export default function NuevaTasacionPage() {
  const router = useRouter()
  const { toast } = useToast()
  const searchParams = useSearchParams()
  const [saving, setSaving] = useState(false)
  const [linkedProperty, setLinkedProperty] = useState<{
    id: string; address: string; neighborhood: string; city: string; property_type: string; size_m2: number | null
  } | null>(null)

  const [templates, setTemplates] = useState<TasacionTemplate[]>([])
  const [templatesLoading, setTemplatesLoading] = useState(true)
  const [templatesAvailable, setTemplatesAvailable] = useState(true)
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)

  const [form, setForm] = useState({
    property_address: '',
    neighborhood: '',
    city: 'Buenos Aires',
    property_type: 'departamento',
    covered_area: '',
    total_area: '',
    semi_area: '',
    contact_name: '',
    contact_phone: '',
    contact_email: '',
    suggested_price: '',
    test_price: '',
    expected_close_price: '',
    strengths: '',
    weaknesses: '',
    opportunities: '',
    threats: '',
    publication_analysis: '',
  })

  useEffect(() => {
    const pid = searchParams.get('property_id')
    if (!pid) return
    apiFetch('properties', `/properties/${pid}`)
      .then(r => r.json() as any)
      .then((p: any) => {
        if (!p.id) return
        const prop = { id: p.id, address: p.address, neighborhood: p.neighborhood, city: p.city, property_type: p.property_type, size_m2: p.size_m2 ?? null }
        setLinkedProperty(prop)
        setForm(f => ({
          ...f,
          property_address: p.address || '',
          neighborhood: p.neighborhood || '',
          city: p.city || f.city,
          property_type: p.property_type || f.property_type,
          total_area: p.size_m2 ? String(p.size_m2) : f.total_area,
        }))
      })
      .catch(() => {})
  }, [searchParams])

  useEffect(() => {
    let alive = true
    setTemplatesLoading(true)
    apiFetch('properties', '/landings/templates?type=tasacion')
      .then(async (r) => {
        if (!r.ok) {
          // 404 u otro: API no disponible aún -> empty state graceful
          if (alive) { setTemplatesAvailable(false); setTemplates([]) }
          return
        }
        const data = (await r.json()) as any
        const list: TasacionTemplate[] = Array.isArray(data)
          ? data
          : Array.isArray(data?.templates)
            ? data.templates
            : Array.isArray(data?.landings)
              ? data.landings
              : []
        if (alive) {
          setTemplates(list)
          setTemplatesAvailable(true)
        }
      })
      .catch(() => { if (alive) { setTemplatesAvailable(false); setTemplates([]) } })
      .finally(() => { if (alive) setTemplatesLoading(false) })
    return () => { alive = false }
  }, [])

  function handlePropertySelect(p: typeof linkedProperty) {
    setLinkedProperty(p)
    if (p) {
      setForm(f => ({
        ...f,
        property_address: p.address,
        neighborhood: p.neighborhood,
        city: p.city,
        property_type: p.property_type,
        total_area: p.size_m2 ? String(p.size_m2) : f.total_area,
      }))
    }
  }

  const handleSave = async () => {
    if (!form.property_address) { toast('La dirección es requerida', 'error'); return }
    setSaving(true)
    try {
      // Si hay plantilla seleccionada → clonar landing como tasación
      if (selectedTemplateId) {
        const cloneBody: any = { address: form.property_address }
        if (linkedProperty) cloneBody.property_id = linkedProperty.id
        const cloneRes = await apiFetch('properties', `/landings/${selectedTemplateId}/clone-as-tasacion`, {
          method: 'POST',
          body: JSON.stringify(cloneBody),
        })
        if (!cloneRes.ok) {
          if (cloneRes.status === 404) {
            toast('Plantilla no disponible aún', 'error')
          } else {
            toast('No se pudo crear la tasación desde plantilla', 'error')
          }
          setSaving(false)
          return
        }
        const cloneData = (await cloneRes.json()) as any
        if (cloneData?.appraisal_id) {
          toast('Tasación creada desde plantilla')
          router.push(`/tasaciones/${cloneData.appraisal_id}/editar`)
          return
        }
        toast('Respuesta inesperada del servidor', 'error')
        setSaving(false)
        return
      }

      // Flujo actual sin plantilla
      const payload: any = { ...form }
      if (linkedProperty) payload.property_id = linkedProperty.id
      if (form.covered_area) payload.covered_area = Number(form.covered_area)
      if (form.total_area) payload.total_area = Number(form.total_area)
      if (form.semi_area) payload.semi_area = Number(form.semi_area)
      if (form.suggested_price) payload.suggested_price = Number(form.suggested_price)
      if (form.test_price) payload.test_price = Number(form.test_price)
      if (form.expected_close_price) payload.expected_close_price = Number(form.expected_close_price)

      const res = await apiFetch('properties', '/appraisals', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      const data = (await res.json()) as any
      if (data.id) {
        toast('Tasación creada')
        router.push(`/tasaciones/${data.id}`)
      } else {
        toast(data.error || 'Error al crear', 'error')
      }
    } catch { toast('Error de conexión', 'error') }
    setSaving(false)
  }

  const inputClass = 'border rounded-lg px-3 py-2 text-sm w-full focus:ring-2 focus:ring-[#ff007c]/50 focus:border-[#ff007c]'

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/tasaciones" className="flex items-center gap-2 text-gray-500 hover:text-gray-700 text-sm">
          <ArrowLeft className="w-4 h-4" /> Tasaciones
        </Link>
      </div>

      <div className="flex items-center justify-between">
        <h1 className="text-xl sm:text-2xl font-semibold text-gray-800">Nueva tasación</h1>
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 bg-[#ff007c] text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Crear tasación
        </button>
      </div>

      {/* Plantilla de tasación (opcional) */}
      <div className="bg-white rounded-xl border p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#ff007c] to-[#ff8017] text-white flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-800">Crear desde plantilla (opcional)</h2>
            <p className="text-sm text-gray-500">
              Elegí una plantilla con bloques pre-armados (propuesta, FODA, etc.).
              Solo vas a editar las partes variables de cada tasación.
            </p>
          </div>
        </div>

        {templatesLoading ? (
          <div className="text-sm text-gray-400">Cargando plantillas…</div>
        ) : !templatesAvailable || templates.length === 0 ? (
          <div className="text-sm text-gray-500 bg-gray-50 border border-dashed border-gray-200 rounded-lg px-4 py-3">
            Sin plantillas disponibles.{' '}
            <Link href="/landings/nueva?template_type=tasacion" className="text-[#ff007c] font-medium hover:underline">
              + Crear plantilla nueva
            </Link>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setSelectedTemplateId(null)}
                className={`px-3 py-1.5 rounded-full text-sm border transition ${
                  selectedTemplateId === null
                    ? 'bg-[#ff007c] text-white border-[#ff007c]'
                    : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'
                }`}
              >
                Sin plantilla
              </button>
              {templates.map(t => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSelectedTemplateId(t.id)}
                  className={`px-3 py-1.5 rounded-full text-sm border transition ${
                    selectedTemplateId === t.id
                      ? 'bg-[#ff007c] text-white border-[#ff007c]'
                      : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {t.name}
                </button>
              ))}
            </div>
            <Link
              href="/landings/nueva?template_type=tasacion"
              className="inline-flex items-center gap-1.5 text-sm text-[#ff007c] font-medium hover:underline"
            >
              <Plus className="w-3.5 h-3.5" /> Crear plantilla nueva
            </Link>
            {selectedTemplateId && (
              <p className="text-xs text-gray-500">
                Al crear se clonarán los bloques de la plantilla en la tasación. Solo necesitás la dirección.
              </p>
            )}
          </>
        )}
      </div>

      {/* Propiedad vinculada */}
      <div className="bg-white rounded-xl border p-6 space-y-3">
        <h2 className="font-semibold text-gray-800">Propiedad existente (opcional)</h2>
        <p className="text-sm text-gray-500">Seleccioná una propiedad del sistema para vincular esta tasación.</p>
        <PropertySelector value={linkedProperty} onChange={handlePropertySelect} />
      </div>

      {/* Propiedad */}
      <div className="bg-white rounded-xl border p-6 space-y-4">
        <h2 className="font-semibold text-gray-800">Datos de la propiedad</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Dirección *</label>
            <input value={form.property_address} onChange={e => setForm(f => ({ ...f, property_address: e.target.value }))}
              placeholder="Ej: Av. Corrientes 1234" className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Barrio</label>
            <input value={form.neighborhood} onChange={e => setForm(f => ({ ...f, neighborhood: e.target.value }))}
              placeholder="Palermo" className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ciudad</label>
            <input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
            <select value={form.property_type} onChange={e => setForm(f => ({ ...f, property_type: e.target.value }))} className={inputClass}>
              {PROPERTY_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sup. cubierta (m²)</label>
            <input type="number" value={form.covered_area} onChange={e => setForm(f => ({ ...f, covered_area: e.target.value }))} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sup. total (m²)</label>
            <input type="number" value={form.total_area} onChange={e => setForm(f => ({ ...f, total_area: e.target.value }))} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sup. semicubierta (m²)</label>
            <input type="number" value={form.semi_area} onChange={e => setForm(f => ({ ...f, semi_area: e.target.value }))} className={inputClass} />
          </div>
        </div>
      </div>

      {/* Propietario */}
      <div className="bg-white rounded-xl border p-6 space-y-4">
        <h2 className="font-semibold text-gray-800">Datos del propietario</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
            <input value={form.contact_name} onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
            <input value={form.contact_phone} onChange={e => setForm(f => ({ ...f, contact_phone: e.target.value }))} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input type="email" value={form.contact_email} onChange={e => setForm(f => ({ ...f, contact_email: e.target.value }))} className={inputClass} />
          </div>
        </div>
      </div>

      {/* Precio */}
      <div className="bg-white rounded-xl border p-6 space-y-4">
        <h2 className="font-semibold text-gray-800">Valuación</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Precio sugerido (USD)</label>
            <input type="number" value={form.suggested_price} onChange={e => setForm(f => ({ ...f, suggested_price: e.target.value }))} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Precio de prueba (USD)</label>
            <input type="number" value={form.test_price} onChange={e => setForm(f => ({ ...f, test_price: e.target.value }))} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Precio de cierre (USD)</label>
            <input type="number" value={form.expected_close_price} onChange={e => setForm(f => ({ ...f, expected_close_price: e.target.value }))} className={inputClass} />
          </div>
        </div>
      </div>

      {/* Análisis */}
      <div className="bg-white rounded-xl border p-6 space-y-4">
        <h2 className="font-semibold text-gray-800">Análisis FODA</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { key: 'strengths', label: 'Fortalezas' },
            { key: 'weaknesses', label: 'Debilidades' },
            { key: 'opportunities', label: 'Oportunidades' },
            { key: 'threats', label: 'Amenazas' },
          ].map(({ key, label }) => (
            <div key={key}>
              <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
              <textarea rows={3} value={(form as any)[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                className={inputClass} />
            </div>
          ))}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Análisis de publicación</label>
          <textarea rows={4} value={form.publication_analysis} onChange={e => setForm(f => ({ ...f, publication_analysis: e.target.value }))}
            className={inputClass} />
        </div>
      </div>

      <div className="flex justify-end pb-8">
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 bg-[#ff007c] text-white px-6 py-3 rounded-xl text-sm font-medium hover:opacity-90 disabled:opacity-50">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Crear tasación
        </button>
      </div>
    </div>
  )
}
