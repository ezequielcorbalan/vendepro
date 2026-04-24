'use client'
import { PropertySelector } from '@/components/ui/PropertySelector'
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

        {/* Weighted area */}
        <div>
          <label className={labelClass}>Sup. ponderada (m²)</label>
          <input
            type="number"
            min={0}
            value={property.weighted_area ?? ''}
            onChange={(e) =>
              onPatchProperty({ weighted_area: e.target.value ? Number(e.target.value) : null })
            }
            className={inputClass}
          />
        </div>

        {/* Lead ID — plain text input (no lead-specific selector available) */}
        <div className="md:col-span-2">
          <label className={labelClass}>ID de lead (opcional)</label>
          <input
            type="text"
            value={leadId ?? ''}
            onChange={(e) => onSetLead(e.target.value.trim() || null)}
            placeholder="Pegá el ID del lead vinculado"
            className={inputClass}
          />
          <p className="mt-1 text-xs text-slate-400">
            Podés vincular el lead desde el editor una vez creada la tasación.
          </p>
        </div>
      </div>
    </div>
  )
}
