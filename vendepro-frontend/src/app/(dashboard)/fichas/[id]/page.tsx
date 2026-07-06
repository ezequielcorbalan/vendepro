'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Save, Loader2, ChevronDown, ChevronUp,
  Home, Ruler, DoorOpen, Thermometer, DollarSign,
  CheckCircle, ClipboardList, Trash2,
} from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'

// ── Collapsible section ─────────────────────────────────────
function Section({ title, icon: Icon, children, defaultOpen = false }: { title: string; icon: any; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
      <button type="button" onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-4 py-3.5 text-left">
        <div className="flex items-center gap-2.5">
          <Icon className="w-4 h-4 text-brand-pink" />
          <span className="text-sm font-semibold text-gray-800">{title}</span>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>
      {open && <div className="px-4 pb-4 space-y-3 border-t border-gray-50">{children}</div>}
    </div>
  )
}

const inputClass = 'w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand-pink/30 focus:border-brand-pink outline-none bg-white'
const labelClass = 'block text-xs font-medium text-gray-500 mb-1'

function RadioGroup({ label, options, value, onChange }: { label: string; options: { value: string; label: string }[]; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <p className={labelClass}>{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map(o => (
          <button key={o.value} type="button" onClick={() => onChange(o.value)}
            className={`text-xs px-3 py-2 rounded-lg border transition-colors ${value === o.value ? 'bg-brand-pink text-white border-brand-pink' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function BoolToggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!value)}
      className={`flex items-center gap-2 text-xs px-3 py-2.5 rounded-lg border w-full transition-colors ${value ? 'bg-green-50 text-green-700 border-green-200' : 'bg-white text-gray-500 border-gray-200'}`}>
      <div className={`w-4 h-4 rounded border flex items-center justify-center ${value ? 'bg-green-500 border-green-500' : 'border-gray-300'}`}>
        {value && <CheckCircle className="w-3 h-3 text-white" />}
      </div>
      {label}
    </button>
  )
}

const toNum = (v: string): number | null => {
  if (v === '' || v === null || v === undefined) return null
  const n = Number(v)
  return Number.isNaN(n) ? null : n
}

type Orientation = { norte: string; sur: string; este: string; oeste: string }

function safeParseOrientation(raw: unknown): Orientation {
  const empty: Orientation = { norte: '', sur: '', este: '', oeste: '' }
  if (!raw || typeof raw !== 'string') return empty
  try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object') {
      return {
        norte: parsed.norte ?? '',
        sur: parsed.sur ?? '',
        este: parsed.este ?? '',
        oeste: parsed.oeste ?? '',
      }
    }
  } catch { /* ignore */ }
  return empty
}

function safeParseAmenities(raw: unknown): { items: string[]; other: string } {
  if (!raw || typeof raw !== 'string') return { items: [], other: '' }
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return { items: parsed.filter(x => typeof x === 'string'), other: '' }
    if (parsed && typeof parsed === 'object') {
      return {
        items: Array.isArray(parsed.items) ? parsed.items.filter((x: unknown) => typeof x === 'string') : [],
        other: typeof parsed.other === 'string' ? parsed.other : '',
      }
    }
  } catch { /* ignore */ }
  return { items: [], other: '' }
}

export default function FichaDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const fichaId = params.id as string

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const [leadId, setLeadId] = useState<string | null>(null)

  const [f, setF] = useState({
    inspection_date: '',
    address: '',
    neighborhood: '',
    property_type: '',
    floor_number: '',
    elevators: '',
    age: '',
    building_category: '',
    property_condition: '',
    covered_area: '',
    semi_area: '',
    uncovered_area: '',
    m2_value_neighborhood: '',
    m2_value_zone: '',
    bedrooms: '',
    bathrooms: '',
    storage_rooms: '',
    parking_spots: '',
    air_conditioning: '',
    bedroom_dimensions: '',
    living_dimensions: '',
    kitchen_dimensions: '',
    bathroom_dimensions: '',
    floor_type: '',
    disposition: '',
    orientation: { norte: '', sur: '', este: '', oeste: '' } as Orientation,
    balcony_type: '',
    heating_type: '',
    noise_level: '',
    amenities_list: [] as string[],
    amenities_other: '',
    is_professional: false,
    is_occupied: false,
    is_credit_eligible: false,
    sells_to_buy: false,
    expenses: '',
    abl: '',
    aysa: '',
    notes: '',
  })

  const u = (field: string, value: any) => setF(prev => ({ ...prev, [field]: value }))

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await apiFetch('properties', `/fichas/${fichaId}`)
        if (!res.ok) {
          setNotFound(true)
          setLoading(false)
          return
        }
        const data = (await res.json()) as any
        if (cancelled) return
        const amenities = safeParseAmenities(data.amenities)
        setLeadId(data.lead_id ?? null)
        setF({
          inspection_date: (data.inspection_date ?? '').slice(0, 10),
          address: data.address ?? '',
          neighborhood: data.neighborhood ?? '',
          property_type: data.property_type ?? '',
          floor_number: data.floor_number ?? '',
          elevators: data.elevators ?? '',
          age: data.age ?? '',
          building_category: data.building_category ?? '',
          property_condition: data.property_condition ?? '',
          covered_area: data.covered_area != null ? String(data.covered_area) : '',
          semi_area: data.semi_area != null ? String(data.semi_area) : '',
          uncovered_area: data.uncovered_area != null ? String(data.uncovered_area) : '',
          m2_value_neighborhood: data.m2_value_neighborhood != null ? String(data.m2_value_neighborhood) : '',
          m2_value_zone: data.m2_value_zone != null ? String(data.m2_value_zone) : '',
          bedrooms: data.bedrooms != null ? String(data.bedrooms) : '',
          bathrooms: data.bathrooms != null ? String(data.bathrooms) : '',
          storage_rooms: data.storage_rooms != null ? String(data.storage_rooms) : '',
          parking_spots: data.parking_spots != null ? String(data.parking_spots) : '',
          air_conditioning: data.air_conditioning != null ? String(data.air_conditioning) : '',
          bedroom_dimensions: data.bedroom_dimensions ?? '',
          living_dimensions: data.living_dimensions ?? '',
          kitchen_dimensions: data.kitchen_dimensions ?? '',
          bathroom_dimensions: data.bathroom_dimensions ?? '',
          floor_type: data.floor_type ?? '',
          disposition: data.disposition ?? '',
          orientation: safeParseOrientation(data.orientation),
          balcony_type: data.balcony_type ?? '',
          heating_type: data.heating_type ?? '',
          noise_level: data.noise_level ?? '',
          amenities_list: amenities.items,
          amenities_other: amenities.other,
          is_professional: !!data.is_professional,
          is_occupied: !!data.is_occupied,
          is_credit_eligible: !!data.is_credit_eligible,
          sells_to_buy: !!data.sells_to_buy,
          expenses: data.expenses != null ? String(data.expenses) : '',
          abl: data.abl != null ? String(data.abl) : '',
          aysa: data.aysa != null ? String(data.aysa) : '',
          notes: data.notes ?? '',
        })
      } catch {
        if (!cancelled) setNotFound(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [fichaId])

  async function handleSave() {
    if (!f.address.trim()) {
      toast('La dirección es obligatoria', 'error')
      return
    }
    setSaving(true)
    try {
      const payload = {
        inspection_date: f.inspection_date || null,
        address: f.address.trim(),
        neighborhood: f.neighborhood || null,
        property_type: f.property_type || null,
        floor_number: f.floor_number || null,
        elevators: f.elevators || null,
        age: f.age || null,
        building_category: f.building_category || null,
        property_condition: f.property_condition || null,
        covered_area: toNum(f.covered_area),
        semi_area: toNum(f.semi_area),
        uncovered_area: toNum(f.uncovered_area),
        m2_value_neighborhood: toNum(f.m2_value_neighborhood),
        m2_value_zone: toNum(f.m2_value_zone),
        bedrooms: toNum(f.bedrooms),
        bathrooms: toNum(f.bathrooms),
        storage_rooms: toNum(f.storage_rooms),
        parking_spots: toNum(f.parking_spots),
        air_conditioning: toNum(f.air_conditioning),
        bedroom_dimensions: f.bedroom_dimensions || null,
        living_dimensions: f.living_dimensions || null,
        kitchen_dimensions: f.kitchen_dimensions || null,
        bathroom_dimensions: f.bathroom_dimensions || null,
        floor_type: f.floor_type || null,
        disposition: f.disposition || null,
        orientation: JSON.stringify(f.orientation),
        balcony_type: f.balcony_type || null,
        heating_type: f.heating_type || null,
        noise_level: f.noise_level || null,
        amenities: JSON.stringify({ items: f.amenities_list, other: f.amenities_other || null }),
        is_professional: f.is_professional ? 1 : 0,
        is_occupied: f.is_occupied ? 1 : 0,
        is_credit_eligible: f.is_credit_eligible ? 1 : 0,
        sells_to_buy: f.sells_to_buy ? 1 : 0,
        expenses: toNum(f.expenses),
        abl: toNum(f.abl),
        aysa: toNum(f.aysa),
        notes: f.notes || null,
      }
      const res = await apiFetch('properties', `/fichas/${fichaId}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      })
      const data = (await res.json()) as any
      if (!res.ok || data?.error) {
        toast(data?.error || 'No se pudo actualizar la ficha', 'error')
      } else {
        toast('Ficha actualizada')
      }
    } catch {
      toast('Error de conexión', 'error')
    }
    setSaving(false)
  }

  async function handleDelete() {
    if (!confirm('¿Eliminar esta ficha? Esta acción no se puede deshacer.')) return
    try {
      const res = await apiFetch('properties', `/fichas/${fichaId}`, { method: 'DELETE' })
      if (!res.ok) {
        toast('No se pudo eliminar', 'error')
        return
      }
      toast('Ficha eliminada', 'warning')
      if (leadId) router.push(`/leads/${leadId}`)
      else router.push('/tasaciones')
    } catch {
      toast('Error de conexión', 'error')
    }
  }

  const backHref = leadId ? `/leads/${leadId}` : '/tasaciones'

  if (loading) {
    return (
      <div className="max-w-lg mx-auto space-y-4 animate-pulse">
        <div className="h-6 w-32 bg-gray-200 rounded" />
        <div className="h-20 bg-gray-200 rounded-xl" />
        <div className="h-40 bg-gray-200 rounded-xl" />
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="max-w-lg mx-auto text-center py-12">
        <p className="text-gray-500">Ficha no encontrada</p>
        <Link href="/tasaciones" className="text-brand-pink hover:underline text-sm mt-2 inline-block">Volver a Tasaciones</Link>
      </div>
    )
  }

  const toggleAmenity = (v: string) =>
    setF(prev => ({ ...prev, amenities_list: prev.amenities_list.includes(v) ? prev.amenities_list.filter(x => x !== v) : [...prev.amenities_list, v] }))

  return (
    <div className="max-w-lg mx-auto pb-24">
      <div className="flex items-center justify-between mb-4">
        <Link href={backHref} className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-gray-600">
          <ArrowLeft className="w-4 h-4" /> Volver
        </Link>
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push(`/propiedades/nueva?ficha_id=${fichaId}${leadId ? `&lead_id=${leadId}` : ''}`)}
            className="flex items-center gap-1.5 bg-green-600 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-green-700 font-medium"
          >
            <Home className="w-3.5 h-3.5" /> Crear propiedad
          </button>
          <button onClick={handleDelete} className="p-1.5 border rounded-lg text-gray-400 hover:text-red-500 hover:border-red-200">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-pink to-brand-orange flex items-center justify-center">
          <ClipboardList className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-gray-800">Ficha de Tasación</h1>
          <p className="text-xs text-gray-400">{f.address || 'Sin dirección'}</p>
        </div>
      </div>

      <div className="space-y-3">
        <Section title="Datos generales" icon={Home} defaultOpen={true}>
          <div>
            <label className={labelClass}>Fecha de inspección</label>
            <input type="date" className={inputClass} value={f.inspection_date} onChange={e => u('inspection_date', e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Dirección *</label>
            <input className={inputClass} value={f.address} onChange={e => u('address', e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Barrio</label>
            <input className={inputClass} value={f.neighborhood} onChange={e => u('neighborhood', e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Tipología</label>
            <input className={inputClass} value={f.property_type} onChange={e => u('property_type', e.target.value)} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div><label className={labelClass}>Piso</label><input className={inputClass} value={f.floor_number} onChange={e => u('floor_number', e.target.value)} /></div>
            <div><label className={labelClass}>Ascensores</label><input className={inputClass} value={f.elevators} onChange={e => u('elevators', e.target.value)} /></div>
            <div><label className={labelClass}>Antigüedad</label><input className={inputClass} value={f.age} onChange={e => u('age', e.target.value)} /></div>
          </div>
          <RadioGroup label="Categoría del edificio" value={f.building_category} onChange={v => u('building_category', v)}
            options={[{ value: 'excelente', label: 'Excelente' }, { value: 'bueno', label: 'Bueno' }, { value: 'regular', label: 'Regular' }]} />
          <RadioGroup label="Estado" value={f.property_condition} onChange={v => u('property_condition', v)}
            options={[{ value: 'muy_bueno', label: 'Muy bueno' }, { value: 'regular', label: 'Regular' }, { value: 'a_refaccionar', label: 'A refaccionar' }]} />
        </Section>

        <Section title="Superficies y valores" icon={Ruler}>
          <div className="grid grid-cols-3 gap-2">
            <div><label className={labelClass}>Cubierta m²</label><input className={inputClass} type="number" value={f.covered_area} onChange={e => u('covered_area', e.target.value)} /></div>
            <div><label className={labelClass}>Semi m²</label><input className={inputClass} type="number" value={f.semi_area} onChange={e => u('semi_area', e.target.value)} /></div>
            <div><label className={labelClass}>Desc. m²</label><input className={inputClass} type="number" value={f.uncovered_area} onChange={e => u('uncovered_area', e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className={labelClass}>USD/m² barrio</label><input className={inputClass} type="number" value={f.m2_value_neighborhood} onChange={e => u('m2_value_neighborhood', e.target.value)} /></div>
            <div><label className={labelClass}>USD/m² zona</label><input className={inputClass} type="number" value={f.m2_value_zone} onChange={e => u('m2_value_zone', e.target.value)} /></div>
          </div>
        </Section>

        <Section title="Ambientes" icon={DoorOpen}>
          <div className="grid grid-cols-2 gap-2">
            <div><label className={labelClass}>Dormitorios</label><input className={inputClass} type="number" value={f.bedrooms} onChange={e => u('bedrooms', e.target.value)} /></div>
            <div><label className={labelClass}>Baños</label><input className={inputClass} type="number" value={f.bathrooms} onChange={e => u('bathrooms', e.target.value)} /></div>
            <div><label className={labelClass}>Bauleras</label><input className={inputClass} type="number" value={f.storage_rooms} onChange={e => u('storage_rooms', e.target.value)} /></div>
            <div><label className={labelClass}>Cocheras</label><input className={inputClass} type="number" value={f.parking_spots} onChange={e => u('parking_spots', e.target.value)} /></div>
            <div><label className={labelClass}>Aires acond.</label><input className={inputClass} type="number" value={f.air_conditioning} onChange={e => u('air_conditioning', e.target.value)} /></div>
          </div>
          <div><label className={labelClass}>Medidas dormitorios</label><input className={inputClass} value={f.bedroom_dimensions} onChange={e => u('bedroom_dimensions', e.target.value)} /></div>
          <div className="grid grid-cols-3 gap-2">
            <div><label className={labelClass}>Living</label><input className={inputClass} value={f.living_dimensions} onChange={e => u('living_dimensions', e.target.value)} /></div>
            <div><label className={labelClass}>Cocina</label><input className={inputClass} value={f.kitchen_dimensions} onChange={e => u('kitchen_dimensions', e.target.value)} /></div>
            <div><label className={labelClass}>Baños</label><input className={inputClass} value={f.bathroom_dimensions} onChange={e => u('bathroom_dimensions', e.target.value)} /></div>
          </div>
        </Section>

        <Section title="Características" icon={Home}>
          <div>
            <label className={labelClass}>Pisos</label>
            <input className={inputClass} value={f.floor_type} onChange={e => u('floor_type', e.target.value)} />
          </div>
          <RadioGroup label="Disposición" value={f.disposition} onChange={v => u('disposition', v)}
            options={[{ value: 'frente', label: 'Frente' }, { value: 'contrafrente', label: 'Contrafrente' }, { value: 'lateral_interno', label: 'Lateral/Interno' }]} />
          <div>
            <p className={labelClass}>Orientación / Luminosidad</p>
            <div className="grid grid-cols-2 gap-2">
              <input className={inputClass} placeholder="Norte" value={f.orientation.norte} onChange={e => setF(p => ({ ...p, orientation: { ...p.orientation, norte: e.target.value } }))} />
              <input className={inputClass} placeholder="Sur" value={f.orientation.sur} onChange={e => setF(p => ({ ...p, orientation: { ...p.orientation, sur: e.target.value } }))} />
              <input className={inputClass} placeholder="Este" value={f.orientation.este} onChange={e => setF(p => ({ ...p, orientation: { ...p.orientation, este: e.target.value } }))} />
              <input className={inputClass} placeholder="Oeste" value={f.orientation.oeste} onChange={e => setF(p => ({ ...p, orientation: { ...p.orientation, oeste: e.target.value } }))} />
            </div>
          </div>
          <div>
            <label className={labelClass}>Tipo de balcón</label>
            <input className={inputClass} value={f.balcony_type} onChange={e => u('balcony_type', e.target.value)} />
          </div>
        </Section>

        <Section title="Instalaciones y entorno" icon={Thermometer}>
          <div>
            <label className={labelClass}>Calefacción</label>
            <input className={inputClass} value={f.heating_type} onChange={e => u('heating_type', e.target.value)} />
          </div>
          <RadioGroup label="Ruidos" value={f.noise_level} onChange={v => u('noise_level', v)}
            options={[{ value: 'silencioso', label: 'Silencioso' }, { value: 'promedio', label: 'Promedio' }, { value: 'ruidoso', label: 'Ruidoso' }]} />
          <div>
            <p className={labelClass}>Servicios y amenities</p>
            <div className="flex flex-wrap gap-2">
              {[
                { value: 'pileta', label: 'Pileta' }, { value: 'laundry', label: 'Laundry' },
                { value: 'sum', label: 'SUM' }, { value: 'vigilancia', label: 'Vigilancia 24hs' },
                { value: 'gimnasio', label: 'Gimnasio' }, { value: 'solarium', label: 'Solarium' },
                { value: 'parrilla', label: 'Parrilla' }, { value: 'bicicletero', label: 'Bicicletero' },
              ].map(o => (
                <button key={o.value} type="button" onClick={() => toggleAmenity(o.value)}
                  className={`text-xs px-3 py-2 rounded-lg border transition-colors ${f.amenities_list.includes(o.value) ? 'bg-brand-pink text-white border-brand-pink' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}>
                  {o.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className={labelClass}>Otro amenity</label>
            <input className={inputClass} value={f.amenities_other} onChange={e => u('amenities_other', e.target.value)} />
          </div>
        </Section>

        <Section title="Situación" icon={DollarSign}>
          <div className="grid grid-cols-2 gap-2">
            <BoolToggle label="Apto profesional" value={f.is_professional} onChange={v => u('is_professional', v)} />
            <BoolToggle label="Propiedad ocupada" value={f.is_occupied} onChange={v => u('is_occupied', v)} />
            <BoolToggle label="Apto crédito" value={f.is_credit_eligible} onChange={v => u('is_credit_eligible', v)} />
            <BoolToggle label="Vende para comprar" value={f.sells_to_buy} onChange={v => u('sells_to_buy', v)} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div><label className={labelClass}>Expensas $</label><input className={inputClass} type="number" value={f.expenses} onChange={e => u('expenses', e.target.value)} /></div>
            <div><label className={labelClass}>ABL $</label><input className={inputClass} type="number" value={f.abl} onChange={e => u('abl', e.target.value)} /></div>
            <div><label className={labelClass}>AySA $</label><input className={inputClass} type="number" value={f.aysa} onChange={e => u('aysa', e.target.value)} /></div>
          </div>
        </Section>

        <Section title="Notas" icon={ClipboardList}>
          <textarea className={`${inputClass} h-24`} value={f.notes} onChange={e => u('notes', e.target.value)} />
        </Section>
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-100 z-40">
        <div className="max-w-lg mx-auto">
          <button
            onClick={handleSave}
            disabled={saving || !f.address.trim()}
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-brand-pink to-brand-orange text-white py-3.5 rounded-xl font-semibold text-sm hover:opacity-90 disabled:opacity-50 shadow-lg shadow-pink-200"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </div>
  )
}
