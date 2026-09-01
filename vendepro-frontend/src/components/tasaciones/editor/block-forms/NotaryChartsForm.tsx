'use client'
import { BlockField, BlockInput } from '../BlockField'
import ImageUpload from '@/components/landings/ImageUpload'

interface Props { data: any; onPatch: (p: Record<string, unknown>) => void; compact?: boolean }

/**
 * Form de "Gastos e impuestos" — históricamente se cargaba referenciando
 * variables (notary.sales_chart, etc.). Ahora se carga directamente:
 * un nombre y una imagen por gráfico. El renderer mantiene compatibilidad
 * con la forma vieja (chart_1_var/chart_2_var) para tasaciones existentes.
 */
export function NotaryChartsForm({ data, onPatch, compact }: Props) {
  return (
    <div className="space-y-4 p-3">
      <BlockField label="Título">
        <BlockInput
          type="text"
          value={data.title ?? ''}
          maxLength={200}
          onChange={e => onPatch({ title: e.target.value })}
        />
      </BlockField>

      <div className={`grid grid-cols-1 gap-4 ${compact ? '' : 'md:grid-cols-2'}`}>
        <div className="space-y-2 rounded border border-gray-200 bg-gray-50/40 p-3">
          <BlockField label="Nombre del gráfico 1">
            <BlockInput
              type="text"
              value={data.chart_1_label ?? ''}
              maxLength={120}
              placeholder="Ej: Ventas mensuales"
              onChange={e => onPatch({ chart_1_label: e.target.value })}
            />
          </BlockField>
          <div>
            <span className="text-xs uppercase tracking-wide text-gray-600">Imagen del gráfico 1</span>
            <div className="mt-1">
              <ImageUpload
                value={data.chart_1_image_url ?? ''}
                onChange={(url: string) => onPatch({ chart_1_image_url: url })}
              />
            </div>
          </div>
        </div>

        <div className="space-y-2 rounded border border-gray-200 bg-gray-50/40 p-3">
          <BlockField label="Nombre del gráfico 2">
            <BlockInput
              type="text"
              value={data.chart_2_label ?? ''}
              maxLength={120}
              placeholder="Ej: Cierres por semestre"
              onChange={e => onPatch({ chart_2_label: e.target.value })}
            />
          </BlockField>
          <div>
            <span className="text-xs uppercase tracking-wide text-gray-600">Imagen del gráfico 2</span>
            <div className="mt-1">
              <ImageUpload
                value={data.chart_2_image_url ?? ''}
                onChange={(url: string) => onPatch({ chart_2_image_url: url })}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
