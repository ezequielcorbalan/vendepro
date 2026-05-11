'use client'
import { useEffect, useState } from 'react'
import { PropertySelector } from '@/components/ui/PropertySelector'
import { LeadSelector, type LeadOption } from '@/components/ui/LeadSelector'
import { apiFetch } from '@/lib/api'
import {
  calcWeightedArea,
  DEFAULT_SURFACE_WEIGHTS,
  isValidWeights,
  type SurfaceWeights,
} from '@/lib/surface-weights'
import type { WizardState } from '../use-wizard-form'

const PROPERTY_TYPES = ['departamento', 'casa', 'ph', 'local', 'terreno', 'oficina', 'otro']

interface Props {
  property: WizardState['property']
  propertyId: string | null
  leadId: string | null
  onPatchProperty: (patch: Partial<WizardState['property']>) => void
  onSetPropertyId: (id: string | null) => void
  onSetLead: (id: string | null) => void
}

const inputClass =
  'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-[#ff007c] focus:outline-none focus:ring-2 focus:ring-[#ff007c]/30'
const labelClass = 'mb-1 block text-sm font-medium text-slate-700'

export function StepProperty({
  property,
  propertyId,
  leadId,
  onPatchProperty,
  onSetPropertyId,
  onSetLead,
}: Props) {
  const [weights, setWeights] = useState<SurfaceWeights>(DEFAULT_SURFACE_WEIGHTS)
  const [selectedLead, setSelectedLead] = useState<LeadOption | null>(null)

  useEffect(() => {
    apiFetch('admin', '/org-settings').then(r => r.json() as Promise<any>).then(d => {
      if (isValidWeights(d.surface_weights)) setWeights(d.surface_weights)
    }).catch(() => { /* fallback al default */ })
  }, [])

  // Si llegamos al step con un leadId pre-existente pero sin info cargada,
  // hidratamos el display del selector con los datos del lead.
  useEffect(() => {
    if (!leadId) { setSelectedLead(null); return }
    if (selectedLead?.id === leadId) return
    apiFetch('crm', `/leads?id=${leadId}`)
      .then(r => r.json() as Promise<any>)
      .then(data => {
        const l = Array.isArray(data) ? data[0] : data
        if (l?.id) {
          setSelectedLead({
            id: l.id,
            full_name: l.full_name ?? '',
            phone: l.phone ?? null,
            property_address: l.property_address ?? null,
            neighborhood: l.neighborhood ?? null,
            stage: l.stage ?? null,
          })
        }
      })
      .catch(() => { /* no-op */ })
  }, [leadId]) // eslint-disable-line react-hooks/exhaustive-deps

  const computedWeighted = calcWeightedArea(
    property.covered_area,
    property.semi_area,
    property.total_area,
    weights,
  )

  // Mantener sincronizado el valor calculado con el campo persistido.
  // Solo actualizamos si difiere — evita ciclos infinitos en re-renders.
  useEffect(() => {
    if (computedWeighted !== null && computedWeighted !== property.weighted_area) {
      onPatchProperty({ weighted_area: computedWeighted })
    }
  }, [computedWeighted])

  const selectedValue = propertyId
    ? {
        id: propertyId,
        address: property.address,
        neighborhood: property.neighborhood ?? '',
        city: property.city ?? '',
        property_type: property.property_type ?? '',
        size_m2: property.total_area ?? null,
      }
    : null

  function handleSelectProperty(p: {
    id: string
    address: string
    neighborhood: string
    city: string
    property_type: string
    size_m2: number | null
  } | null) {
    if (p) {
      onSetPropertyId(p.id)
      onPatchProperty({
        address: p.address,
        neighborhood: p.neighborhood || '',
        city: p.city || '',
        property_type: p.property_type || '',
        total_area: p.size_m2 ?? null,
      })
    } else {
      onSetPropertyId(null)
    }
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-500">
        Buscá una propiedad del CRM para autocompletar los datos, o completá el formulario manualmente.
        Solo la dirección es obligatoria.
      </p>

      {/* Property selector */}
      <div>
        <label className={labelClass}>Propiedad del CRM (opcional)</label>
        <PropertySelector value={selectedValue} onChange={handleSelectProperty} />
        {propertyId && (
          <p className="mt-1 text-xs text-slate-400">
            La tasación quedará vinculada a esta propiedad. Podés editar los campos igualmente.
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Address — required, full width */}
        <div className="md:col-span-2">
          <label className={labelClass}>
            Dirección <span className="text-[#ff007c]">*</span>
          </label>
          <input
            type="text"
            value={property.address}
            onChange={(e) => onPatchProperty({ address: e.target.value })}
            placeholder="Ej: Av. Corrientes 1234, CABA"
            className={inputClass}
            required
          />
        </div>

        {/* Neighborhood */}
        <div>
          <label className={labelClass}>Barrio</label>
          <input
            type="text"
            value={property.neighborhood ?? ''}
            onChange={(e) => onPatchProperty({ neighborhood: e.target.value })}
            placeholder="Palermo"
            className={inputClass}
          />
        </div>

        {/* City */}
        <div>
          <label className={labelClass}>Ciudad</label>
          <input
            type="text"
            value={property.city ?? ''}
            onChange={(e) => onPatchProperty({ city: e.target.value })}
            placeholder="Buenos Aires"
            className={inputClass}
          />
        </div>

        {/* Property type */}
        <div>
          <label className={labelClass}>Tipo de propiedad</label>
          <select
            value={property.property_type ?? ''}
            onChange={(e) => onPatchProperty({ property_type: e.target.value })}
            className={inputClass}
          >
            <option value="">Seleccionar…</option>
            {PROPERTY_TYPES.map((t) => (
              <option key={t} value={t}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </option>
            ))}
          </select>
        </div>

        {/* Covered area */}
        <div>
          <label className={labelClass}>Sup. cubierta (m²)</label>
          <input
            type="number"
            min={0}
            value={property.covered_area ?? ''}
            onChange={(e) =>
              onPatchProperty({ covered_area: e.target.value ? Number(e.target.value) : null })
            }
            className={inputClass}
          />
        </div>

        {/* Total area */}
        <div>
          <label className={labelClass}>Sup. total (m²)</label>
          <input
            type="number"
            min={0}
            value={property.total_area ?? ''}
            onChange={(e) =>
              onPatchProperty({ total_area: e.target.value ? Number(e.target.value) : null })
            }
            className={inputClass}
          />
        </div>

        {/* Semi-covered area */}
        <div>
          <label className={labelClass}>Sup. semicubierta (m²)</label>
          <input
            type="number"
            min={0}
            value={property.semi_area ?? ''}
            onChange={(e) =>
              onPatchProperty({ semi_area: e.target.value ? Number(e.target.value) : null })
            }
            className={inputClass}
          />
        </div>

        {/* Weighted area — auto-calculado */}
        <div>
          <label className={labelClass}>
            Sup. ponderada (m²)
            <span className="ml-2 text-xs font-normal text-slate-400">auto</span>
          </label>
          <div
            className="flex h-[42px] items-center rounded-lg border border-rose-200 bg-rose-50 px-3 text-sm font-semibold text-[#ff007c]"
            title={`${Math.round(weights.covered * 100)}% cubierta + ${Math.round(weights.semi * 100)}% semi + ${Math.round(weights.uncovered * 100)}% descubierta`}
          >
            {computedWeighted !== null ? `${computedWeighted} m²` : '—'}
          </div>
          <p className="mt-1 text-[11px] text-slate-400">
            Pesos: cubierta {Math.round(weights.covered * 100)}% / semi {Math.round(weights.semi * 100)}% /
            descubierta {Math.round(weights.uncovered * 100)}%. Editalos en Configuración.
          </p>
        </div>

        {/* Lead — buscador */}
        <div className="md:col-span-2">
          <label className={labelClass}>Lead vinculado (opcional)</label>
          <LeadSelector
            value={selectedLead}
            onChange={(l) => {
              setSelectedLead(l)
              onSetLead(l?.id ?? null)
            }}
          />
          <p className="mt-1 text-xs text-slate-400">
            Buscá por nombre o teléfono. También podés vincular el lead desde el editor más adelante.
          </p>
        </div>
      </div>
    </div>
  )
}
