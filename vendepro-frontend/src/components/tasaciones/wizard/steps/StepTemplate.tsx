'use client'
import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { listTemplates } from '../../shared/api'
import { OptionCard } from '@/components/ui/OptionCard'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Text } from '@/components/ui/Typography'

interface Props {
  selectedId: string | null
  onSelect: (id: string | null) => void
}

/** Grilla de la selección de plantilla. Las tres columnas y el gap son los
 *  mismos en carga, error y contenido, así el paso no salta al terminar de
 *  cargar. */
const GRID = 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4'

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

  return (
    <div className="space-y-4">
      <Text size="sm" tone="muted" className="block">
        Elegí una plantilla para pre-cargar los bloques de la tasación, o empezá de cero.
      </Text>

      {error ? (
        // Alert del DS en vez de un ícono + párrafo + botón armados a mano.
        <Alert tone="danger" title={error}>
          <Button variant="outline" size="sm" onClick={load} className="mt-2">
            Reintentar
          </Button>
        </Alert>
      ) : (
        <div className={GRID}>
          {/* "Empezar de cero" es una opción más, no otro tipo de tarjeta: antes
              era un botón centrado con borde punteado, así que la grilla tenía
              dos diseños de card conviviendo. */}
          <OptionCard
            orientation="stack"
            icon={<Plus className="w-5 h-5" />}
            title="Empezar de cero"
            description="Sin bloques pre-cargados"
            selected={selectedId === null}
            onClick={() => onSelect(null)}
          />

          {loading
            ? Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="rounded-card border border-gray-200 bg-gray-100 animate-pulse h-32" />
              ))
            : templates.map(t => (
                <OptionCard
                  key={t.id}
                  orientation="stack"
                  title={t.name}
                  description={
                    <>
                      {/* Sin `block`: `line-clamp-2` necesita display:-webkit-box
                          y `block` se lo pisa, así que la descripción no se
                          recortaba y las filas quedaban de distinto alto. */}
                      {t.description && <span className="line-clamp-2">{t.description}</span>}
                      {t.block_count !== undefined && (
                        <span className="block mt-1">{t.block_count} bloques</span>
                      )}
                    </>
                  }
                  selected={selectedId === t.id}
                  onClick={() => onSelect(t.id)}
                />
              ))}
        </div>
      )}
    </div>
  )
}
