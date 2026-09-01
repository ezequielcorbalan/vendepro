'use client'
import { useEffect, useState } from 'react'
import { Clock, Sparkles, Save, CheckCircle2, RotateCcw, History } from 'lucide-react'
import { landingsApi } from '@/lib/landings/api'
import type { LandingVersion } from '@/lib/landings/types'
import { Button } from '@/components/ui/Button'
import { Drawer } from '@/components/ui/Drawer'
import { EmptyState } from '@/components/ui/EmptyState'
import { Text } from '@/components/ui/Typography'

const LABEL_ICON: Record<LandingVersion['label'], React.ComponentType<{ className?: string }>> = {
  'auto-save': Clock,
  'manual-save': Save,
  'ai-edit': Sparkles,
  'publish': CheckCircle2,
}

export default function VersionsDrawer({
  landingId,
  onClose,
  onRollback,
}: {
  landingId: string
  onClose: () => void
  onRollback: () => Promise<void>
}) {
  const [versions, setVersions] = useState<LandingVersion[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    landingsApi.listVersions(landingId).then(r => {
      setVersions(r.versions)
      setLoading(false)
    })
  }, [landingId])

  async function rollback(id: string) {
    if (!confirm('¿Restaurar esta versión? Se crea una nueva versión con este contenido.')) return
    setBusy(id)
    try {
      await landingsApi.rollback(landingId, id)
      await onRollback()
      onClose()
    } finally {
      setBusy(null)
    }
  }

  return (
    <Drawer open onClose={onClose} title="Historial de versiones">
        <div className="space-y-2">
          {loading ? (
            <Text size="sm" tone="muted" className="block text-center mt-8">Cargando…</Text>
          ) : versions.length === 0 ? (
            <EmptyState icon={<History className="w-6 h-6" />} title="Sin versiones todavía." />
          ) : (
            versions.map(v => {
              const Icon = LABEL_ICON[v.label]
              return (
                <div
                  key={v.id}
                  className="border border-gray-200 rounded-control p-3 flex items-start gap-2"
                >
                  <div className="w-8 h-8 rounded-control bg-gray-100 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-4 h-4 text-gray-700" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-ink">
                      v{v.version_number} · {v.label}
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(v.created_at).toLocaleString('es-AR')}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => rollback(v.id)}
                    loading={busy === v.id}
                    icon={<RotateCcw className="w-3 h-3" />}
                    className="text-xs text-primary px-0"
                  >
                    Restaurar
                  </Button>
                </div>
              )
            })
          )}
        </div>
    </Drawer>
  )
}
