'use client'
import type { WizardState } from '../use-wizard-form'

// PropertySelector searches properties, not leads.
// Since no lead-specific selector component exists, lead_id is captured
// via a plain text input. (Flagged: no <PropertySelector kind="lead"/>.)

const PROPERTY_TYPES = ['departamento', 'casa', 'ph', 'local', 'terreno', 'oficina', 'otro']

interface Props {
  property: WizardState['property']
  leadId: string | null
  onPatchProperty: (patch: Partial<WizardState['property']>) => void
  onSetLead: (id: string | null) => void
}

const inputClass =
  'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-[#ff007c] focus:outline-none focus:ring-2 focus:ring-[#ff007c]/30'
const labelClass = 'mb-1 block text-sm font-medium text-slate-700'

export function StepProperty({ property, leadId, onPatchProperty, onSetLead }: Props) {
  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-500">
        Completá los datos de la propiedad a tasar. Solo la dirección es obligatoria.
      </p>

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
