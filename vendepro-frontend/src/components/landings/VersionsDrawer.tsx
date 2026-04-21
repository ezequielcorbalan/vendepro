'use client'
import { useEffect, useState } from 'react'
import { X, Clock, Sparkles, Save, CheckCircle2, RotateCcw } from 'lucide-react'
import { landingsApi } from '@/lib/landings/api'
import type { LandingVersion } from '@/lib/landings/types'

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
    <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose}>
      <aside
        className="absolute right-0 top-0 h-full w-[380px] bg-white shadow-xl flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="font-semibold text-gray-900">Historial de versiones</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-auto p-3 space-y-2">
          {loading ? (
            <p className="text-sm text-gray-500 text-center mt-8">Cargando…</p>
          ) : versions.length === 0 ? (
            <p className="text-sm text-gray-500 text-center mt-8">Sin versiones todavía.</p>
          ) : (
            versions.map(v => {
              const Icon = LABEL_ICON[v.label]
              return (
                <div
                  key={v.id}
                  className="border border-gray-200 rounded-lg p-3 flex items-start gap-2"
                >
                  <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-4 h-4 text-gray-700" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">
                      v{v.version_number} · {v.label}
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(v.created_at).toLocaleString('es-AR')}
                    </p>
                  </div>
                  <button
                    onClick={() => rollback(v.id)}
                    disabled={busy === v.id}
                    className="text-xs text-[#ff007c] hover:underline flex items-center gap-1 disabled:opacity-50"
                  >
                    <RotateCcw className="w-3 h-3" /> Restaurar
                  </button>
                </div>
              )
            })
          )}
        </div>
      </aside>
    </div>
  )
}
