import { notFound } from 'next/navigation'
import { EditorShell } from '@/components/tasaciones/editor/EditorShell'
import { getTemplate, getAppraisal } from '@/components/tasaciones/shared/api'
import type { TemplateBlock } from '@/components/tasaciones/renderer/types'
import '@/components/tasaciones/renderer/print.css'

export default async function EditarTasacionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const appraisal = await getAppraisal(id).catch(() => null)
  if (!appraisal) notFound()

  let snapshot: TemplateBlock[] = []
  if (appraisal.template_snapshot_json) {
    try {
      snapshot = typeof appraisal.template_snapshot_json === 'string'
        ? JSON.parse(appraisal.template_snapshot_json)
        : appraisal.template_snapshot_json
    } catch {}
  } else if (appraisal.template_id) {
    const t = await getTemplate(appraisal.template_id).catch(() => null)
    snapshot = t?.blocks ?? []
  }

  return <EditorShell initial={appraisal} snapshot={snapshot} context="appraisal" />
}
