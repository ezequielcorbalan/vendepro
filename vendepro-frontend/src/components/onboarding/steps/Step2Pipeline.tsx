import { Workflow, ListChecks, BellRing, Filter } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { StepLayout, StepBullets } from '../StepLayout'

// Las etapas del pipeline son ilustrativas acá: el mapa real vive en
// lib/crm-config.ts (LEAD_STAGES / PROPERTY_STAGES).
const stages = ['Lead', 'Contacto', 'Tasación', 'Propiedad', 'Reserva', 'Venta']

export default function Step2Pipeline() {
  return (
    <StepLayout
      icon={<Workflow className="w-7 h-7" />}
      title="El pipeline comercial"
      subtitle="Todo el ciclo de vida de una operación, desde el primer lead hasta el cierre."
    >
      <div className="w-full max-w-md flex flex-wrap items-center justify-center gap-1.5">
        {stages.map((label, i) => (
          <div key={label} className="flex items-center gap-1.5">
            <Badge tone="neutral">{label}</Badge>
            {i < stages.length - 1 && <span className="text-gray-300 text-sm">→</span>}
          </div>
        ))}
      </div>

      <StepBullets
        items={[
          [<ListChecks key="a" className="w-4 h-4" />, 'Cada etapa tiene sus acciones y seguimientos definidos'],
          [<BellRing key="b" className="w-4 h-4" />, 'El sistema te avisa cuando un lead está vencido o sin actividad'],
          [<Filter key="c" className="w-4 h-4" />, 'Filtrá por etapa desde leads, tasaciones o propiedades'],
        ]}
      />
    </StepLayout>
  )
}
