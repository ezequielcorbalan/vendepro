'use client'
import { useEffect, useState } from 'react'
import { AlertCircle, Loader2 } from 'lucide-react'
import { getTemplate, syncTemplate } from '../shared/api'

interface Props {
  appraisalId: string
  templateId: string
  templateSyncedAt: string | null
  onSynced: () => void
}

export function SyncBanner({ appraisalId, templateId, templateSyncedAt, onSynced }: Props) {
  const [templateUpdatedAt, setTemplateUpdatedAt] = useState<string | null>(null)
  const [templateName, setTemplateName] = useState<string>('')
  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    getTemplate(templateId).then(t => {
      setTemplateUpdatedAt(t.updated_at ?? null)
      setTemplateName(t.name ?? '')
    }).catch(() => {})
  }, [templateId])

  const needsSync = templateUpdatedAt && templateSyncedAt && new Date(templateUpdatedAt).getTime() > new Date(templateSyncedAt).getTime()
  if (!needsSync) return null

  const handleSync = async () => {
    setSyncing(true)
    try { await syncTemplate(appraisalId); onSynced() }
    finally { setSyncing(false) }
  }

  return (
    <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-warning/30 bg-warning/10 px-4 py-3 text-sm text-ink">
      <AlertCircle className="h-4 w-4" />
      <span>El template <strong>{templateName}</strong> fue actualizado. Tu tasación todavía usa la versión anterior.</span>
      <button onClick={handleSync} disabled={syncing} className="ml-auto flex items-center gap-1 rounded-control bg-warning px-3 py-1 text-white disabled:opacity-50">
        {syncing && <Loader2 className="h-3 w-3 animate-spin" />} Actualizar mi tasación
      </button>
    </div>
  )
}
