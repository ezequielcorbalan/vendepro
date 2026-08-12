import { LEAD_STAGES, LEAD_PIPELINE_STAGES } from '@/lib/crm-config'
import { Card } from '@/components/ui/Card'
import { Heading } from '@/components/ui/Typography'
import { Target } from 'lucide-react'

/**
 * PREVIEW SÓLO PARA REVISIÓN — copia del widget "Pipeline de leads" del
 * dashboard, con conteos de ejemplo. Sin login, sin fetch. Borrable.
 */
const MOCK_COUNTS: Record<string, number> = {
  nuevo: 12, asignado: 8, contactado: 15, calificado: 6, en_tasacion: 4,
  presentada: 3, seguimiento: 9, captado: 5, perdido: 2, invalido: 1, finalizado: 7,
}

export default function PipelinePreviewPage() {
  return (
    <div className="min-h-screen bg-brand-light p-6">
      <div className="max-w-4xl mx-auto">
        <p className="text-xs text-gray-400 uppercase tracking-widest mb-4">Preview · widget del dashboard (datos de ejemplo)</p>
        <Card className="p-4 sm:p-5">
          <Heading level={4} as="h2" className="mb-3 flex items-center gap-2">
            <Target className="w-4 h-4 text-gray-600" /> Pipeline de leads
          </Heading>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
            {LEAD_PIPELINE_STAGES.map(key => {
              const cfg = LEAD_STAGES[key]
              return (
                <a key={key} href="#" className={`flex flex-col items-center justify-center gap-1 rounded-card p-3 text-center transition-opacity hover:opacity-80 ${cfg.color}`}>
                  <p className="text-xl font-bold">{MOCK_COUNTS[key] || 0}</p>
                  <p className="text-xs font-normal">{cfg.label}</p>
                </a>
              )
            })}
          </div>
        </Card>
      </div>
    </div>
  )
}
