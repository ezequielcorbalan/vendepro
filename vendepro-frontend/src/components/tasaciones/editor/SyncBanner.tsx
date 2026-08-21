'use client'
import { useEffect, useState } from 'react'
import { getTemplate, syncTemplate } from '../shared/api'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'

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
    <Alert tone="warning" className="sticky top-0 z-10 rounded-none border-x-0">
      <div className="flex flex-wrap items-center gap-3">
        <span>El template <strong>{templateName}</strong> fue actualizado. Tu tasación todavía usa la versión anterior.</span>
        <Button variant="outline" size="sm" onClick={handleSync} loading={syncing} className="ml-auto">
          Actualizar mi tasación
        </Button>
      </div>
    </Alert>
  )
}
