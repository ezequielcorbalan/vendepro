'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  ArrowLeft, Save, Loader2, ChevronDown, ChevronUp,
  Home, Ruler, DoorOpen, Thermometer, Volume2, DollarSign,
  CheckCircle, ClipboardList
} from 'lucide-react'
import Link from 'next/link'

// Collapsible section
function Section({ title, icon: Icon, children, defaultOpen = false }: { title: string; icon: any; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-4 py-3.5 text-left">
        <div className="flex items-center gap-2.5">
          <Icon className="w-4 h-4 text-[#ff007c]" />
          <span className="text-sm font-semibold text-gray-800">{title}</span>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>
      {open && <div className="px-4 pb-4 space-y-3 border-t border-gray-50">{children}</div>}
    </div>
  )
}

// Input components
const inputClass = 'w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#ff007c]/30 focus:border-[#ff007c] outline-none bg-white'
const labelClass = 'block text-xs font-medium text-gray-500 mb-1'

function RadioGroup({ label, name, options, value, onChange }: { label: string; name: string; options: { value: string; label: string }[]; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <p className={labelClass}>{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map(o => (
          <button key={o.value} type="button" onClick={() => onChange(o.value)}
            className={`text-xs px-3 py-2 rounded-lg border transition-colors ${value === o.value ? 'bg-[#ff007c] text-white border-[#ff007c]' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function CheckGroup({ label, options, value, onChange }: { label: string; options: { value: string; label: string }[]; value: string[]; onChange: (v: string[]) => void }) {
  const toggle = (v: string) => {
    onChange(value.includes(v) ? value.filter(x => x !== v) : [...value, v])
  }
  return (
    <div>
      <p className={labelClass}>{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map(o => (
          <button key={o.value} type="button" onClick={() => toggle(o.value)}
            className={`text-xs px-3 py-2 rounded-lg border transition-colors ${value.includes(o.value) ? 'bg-[#ff007c] text-white border-[#ff007c]' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}>
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

export default function NuevaFichaPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const leadId = searchParams.get('lead_id')
  const prefillAddress = searchParams.get('address') || ''
  const prefillNeighborhood = searchParams.get('neighborhood') || ''

  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Form state
  const [f, setF] = useState({
    inspection_date: new Date().toISOString().split('T')[0],
    address: prefillAddress,
    neighborhood: prefillNeighborhood,
    property_type: '',
    property_type_other: '',
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
    toilettes: '',
    storage_rooms: '',
    parking_spots: '',
    air_conditioning: '',
    bedroom_dimensions: '',
    living_dimensions: '',
    kitchen_dimensions: '',
    bathroom_dimensions: '',
    floor_type: '',
    floor_type_other: '',
    disposition: '',
    orientation: { norte: '', sur: '', este: '', oeste: '' },
    balcony_type: '',
    heating_type: '',
    heating_type_other: '',
    noise_level: '',
    amenities: [] as string[],
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

  async function handleSave() {
    if (!f.address.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/fichas-tasacion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...f, lead_id: leadId }),
      })
      if (res.ok) {
        setSaved(true)
        setTimeout(() => router.back(), 1500)
      }
    } catch { /* */ }
    setSaving(false)
  }

  return (
    <div className="max-w-lg mx-auto pb-24">
      <Link href={leadId ? `/leads/${leadId}` : '/tasaciones'} className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-gray-600 mb-4">
        <ArrowLeft className="w-4 h-4" /> Volver
      </Link>

      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#ff007c] to-[#ff8017] flex items-center justify-center">
          <ClipboardList className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-gray-800">Ficha de Tasación</h1>
          <p className="text-xs text-gray-400">Completá los datos durante la visita</p>
        </div>
      </div>

      {saved && (
        <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-xl p-3 mb-4 flex items-center gap-2">
          <CheckCircle className="w-4 h-4" /> Ficha guardada correctamente
        </div>
      )}

      <div className="space-y-3">
        {/* 1. Datos generales */}
        <Section title="Datos generales" icon={Home} defaultOpen={true}>
          <div>
            <label className={labelClass}>Fecha de inspección</label>
            <input type="date" className={inputClass} value={f.inspection_date} onChange={e => u('inspection_date', e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Dirección *</label>
            <input className={inputClass} value={f.address} onChange={e => u('address', e.target.value)} placeholder="Av. Triunvirato 4500, 8°B" />
          </div>
          <div>
            <label className={labelClass}>Barrio</label>
            <input className={inputClass} value={f.neighborhood} onChange={e => u('neighborhood', e.target.value)} placeholder="Villa Urquiza" />
          </div>
          <RadioGroup label="Tipología" name="type" value={f.property_type} onChange={v => u('property_type', v)}
            options={[{ value: 'departamento', label: 'Departamento' }, { value: 'ph', label: 'PH' }, { value: 'casa', label: 'Casa' }, { value: 'terreno', label: 'Terreno' }, { value: 'local', label: 'Local' }, { value: 'oficina', label: 'Oficina' }, { value: 'deposito', label: 'Depósito' }, { value: 'otro', label: 'Otro' }]} />
          {f.property_type === 'otro' && (
            <input className={inputClass} placeholder="Especificar tipología..." value={f.property_type_other} onChange={e => u('property_type_other', e.target.value)} />
          )}
          <div className="grid grid-cols-3 gap-2">
            <div><label className={labelClass}>Piso</label><input className={inputClass} value={f.floor_number} onChange={e => u('floor_number', e.target.value)} placeholder="8°B" /></div>
            <div><label className={labelClass}>Ascensores</label><input className={inputClass} type="number" value={f.elevators} onChange={e => u('elevators', e.target.value)} placeholder="2" /></div>
            <div><label className={labelClass}>Antigüedad</label><input className={inputClass} value={f.age} onChange={e => u('age', e.target.value)} placeholder="15 años" /></div>
          </div>
          <RadioGroup label="Categoría del edificio" name="cat" value={f.building_category} onChange={v => u('building_category', v)}
            options={[{ value: 'excelente', label: 'Excelente' }, { value: 'bueno', label: 'Bueno' }, { value: 'regular', label: 'Regular' }]} />
          <RadioGroup label="Estado de la propiedad" name="cond" value={f.property_condition} onChange={v => u('property_condition', v)}
            options={[{ value: 'muy_bueno', label: 'Muy bueno' }, { value: 'regular', label: 'Regular' }, { value: 'a_refaccionar', label: 'A refaccionar' }]} />
        </Section>

        {/* 2. Superficies */}
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

        {/* 3. Ambientes */}
        <Section title="Ambientes" icon={DoorOpen}>
          <div className="grid grid-cols-2 gap-2">
            <div><label className={labelClass}>Dormitorios</label><input className={inputClass} type="number" value={f.bedrooms} onChange={e => u('bedrooms', e.target.value)} /></div>
            <div><label className={labelClass}>Baños</label><input className={inputClass} type="number" value={f.bathrooms} onChange={e => u('bathrooms', e.target.value)} /></div>
            <div><label className={labelClass}>Toilettes</label><input className={inputClass} type="number" value={f.toilettes} onChange={e => u('toilettes', e.target.value)} /></div>
            <div><label className={labelClass}>Bauleras</label><input className={inputClass} type="number" value={f.storage_rooms} onChange={e => u('storage_rooms', e.target.value)} /></div>
            <div><label className={labelClass}>Cocheras</label><input className={inputClass} type="number" value={f.parking_spots} onChange={e => u('parking_spots', e.target.value)} /></div>
            <div><label className={labelClass}>Aires acond.</label><input className={inputClass} type="number" value={f.air_conditioning} onChange={e => u('air_conditioning', e.target.value)} /></div>
          </div>
          <div><label className={labelClass}>Medidas dormitorios</label><input className={inputClass} value={f.bedroom_dimensions} onChange={e => u('bedroom_dimensions', e.target.value)} placeholder="4x3, 3.5x3..." /></div>
          <div className="grid grid-cols-3 gap-2">
            <div><label className={labelClass}>Living</label><input className={inputClass} value={f.living_dimensions} onChange={e => u('living_dimensions', e.target.value)} placeholder="5x4" /></div>
            <div><label className={labelClass}>Cocina</label><input className={inputClass} value={f.kitchen_dimensions} onChange={e => u('kitchen_dimensions', e.target.value)} placeholder="3x2.5" /></div>
            <div><label className={labelClass}>Baños</label><input className={inputClass} value={f.bathroom_dimensions} onChange={e => u('bathroom_dimensions', e.target.value)} placeholder="2x1.5" /></div>
          </div>
        </Section>

        {/* 4. Características */}
        <Section title="Características" icon={Home}>
          <RadioGroup label="Pisos" name="floor" value={f.floor_type} onChange={v => u('floor_type', v)}
            options={[{ value: 'parquet', label: 'Parquet' }, { value: 'ceramicos', label: 'Cerámicos' }, { value: 'alfombra', label: 'Alfombra' }, { value: 'porcelanato', label: 'Porcelanato' }, { value: 'otro', label: 'Otro' }]} />
          {f.floor_type === 'otro' && (
            <input className={inputClass} placeholder="Especificar tipo de piso..." value={f.floor_type_other} onChange={e => u('floor_type_other', e.target.value)} />
          )}
          <RadioGroup label="Disposición" name="disp" value={f.disposition} onChange={v => u('disposition', v)}
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
          <RadioGroup label="Tipo de balcón" name="balcon" value={f.balcony_type} onChange={v => u('balcony_type', v)}
            options={[{ value: 'frances', label: 'Francés' }, { value: 'tradicional', label: 'Tradicional' }, { value: 'corrido', label: 'Corrido' }, { value: 'aterrazado', label: 'Aterrazado' }, { value: 'terraza', label: 'Terraza' }]} />
        </Section>

        {/* 5. Instalaciones */}
        <Section title="Instalaciones y entorno" icon={Thermometer}>
          <RadioGroup label="Calefacción" name="heat" value={f.heating_type} onChange={v => u('heating_type', v)}
            options={[{ value: 'radiadores', label: 'Radiadores' }, { value: 'losa_radiante', label: 'Losa radiante' }, { value: 'split', label: 'Split frío/calor' }, { value: 'otro', label: 'Otro' }]} />
          {f.heating_type === 'otro' && (
            <input className={inputClass} placeholder="Especificar calefacción..." value={f.heating_type_other} onChange={e => u('heating_type_other', e.target.value)} />
          )}
          <RadioGroup label="Ruidos" name="noise" value={f.noise_level} onChange={v => u('noise_level', v)}
            options={[{ value: 'silencioso', label: 'Silencioso' }, { value: 'promedio', label: 'Promedio' }, { value: 'ruidoso', label: 'Ruidoso' }]} />
          <CheckGroup label="Servicios y amenities" options={[
            { value: 'pileta', label: 'Pileta' }, { value: 'laundry', label: 'Laundry' },
            { value: 'sum', label: 'SUM' }, { value: 'vigilancia', label: 'Vigilancia 24hs' },
            { value: 'gimnasio', label: 'Gimnasio' }, { value: 'solarium', label: 'Solarium' },
            { value: 'parrilla', label: 'Parrilla' }, { value: 'bicicletero', label: 'Bicicletero' },
          ]} value={f.amenities} onChange={v => u('amenities', v)} />
          <div>
            <label className={labelClass}>Otro amenity</label>
            <input className={inputClass} placeholder="Especificar otro amenity..." value={f.amenities_other} onChange={e => u('amenities_other', e.target.value)} />
          </div>
        </Section>

        {/* 6. Situación */}
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

        {/* 7. Notas */}
        <Section title="Notas" icon={ClipboardList}>
          <textarea className={`${inputClass} h-24`} value={f.notes} onChange={e => u('notes', e.target.value)} placeholder="Observaciones adicionales de la visita..." />
        </Section>
      </div>

      {/* Fixed save button at bottom */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-100 z-40">
        <div className="max-w-lg mx-auto">
          <button
            onClick={handleSave}
            disabled={saving || !f.address.trim()}
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-[#ff007c] to-[#ff8017] text-white py-3.5 rounded-xl font-semibold text-sm hover:opacity-90 disabled:opacity-50 shadow-lg shadow-pink-200"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Guardando...' : saved ? '¡Guardada!' : 'Guardar ficha'}
          </button>
        </div>
      </div>
    </div>
  )
}
