'use client'
import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { listTemplates } from '../../shared/api'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { OptionCard } from '@/components/ui/OptionCard'
import { Text } from '@/components/ui/Typography'

interface Props {
  selectedId: string | null
  onSelect: (id: string | null) => void
}

export function StepTemplate({ selectedId, onSelect }: Props) {
  const [templates, setTemplates] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    setError(null)
    listTemplates({ active: true })
      .then(setTemplates)
      .catch(() => setError('No se pudieron cargar las plantillas'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-card border bg-slate-100 animate-pulse h-36" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <Alert tone="danger">{error}</Alert>
        <Button variant="outline" onClick={load}>Reintentar</Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <Text tone="muted">
        Elegí una plantilla para pre-cargar los bloques de la tasación, o empezá de cero.
      </Text>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <OptionCard
          title="Empezar de cero"
          description="Sin bloques pre-cargados"
          icon={<Plus className="h-5 w-5" />}
          selected={selectedId === null}
          onClick={() => onSelect(null)}
        />

        {templates.map((t) => (
          <OptionCard
            key={t.id}
            title={t.name}
            description={[t.description, t.block_count !== undefined ? `${t.block_count} bloques` : null]
              .filter(Boolean)
              .join(' · ') || undefined}
            selected={selectedId === t.id}
            onClick={() => onSelect(t.id)}
          />
        ))}
      </div>
    </div>
  )
}
