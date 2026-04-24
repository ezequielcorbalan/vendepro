'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { EditorShell } from '@/components/tasaciones/editor/EditorShell'
import { getTemplate, getAppraisal } from '@/components/tasaciones/shared/api'
import type { TemplateBlock } from '@/components/tasaciones/renderer/types'
import '@/components/tasaciones/renderer/print.css'

function parseSnapshot(raw: unknown): TemplateBlock[] {
  if (!raw) return []
  if (Array.isArray(raw)) return raw as TemplateBlock[]
  if (typeof raw === 'string') {
    try { return JSON.parse(raw) as TemplateBlock[] } catch { return [] }
  }
  return []
}

export default function EditarTasacionPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [appraisal, setAppraisal] = useState<any>(null)
  const [snapshot, setSnapshot] = useState<TemplateBlock[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const a = await getAppraisal(id)
        if (cancelled) return

        let blocks: TemplateBlock[] = parseSnapshot(a.template_snapshot_json)
        if (blocks.length === 0 && a.template_id) {
          try {
            const t = await getTemplate(a.template_id)
            if (t?.blocks) blocks = t.blocks
          } catch {}
        }

        if (cancelled) return
        setAppraisal(a)
        setSnapshot(blocks)
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? 'No se pudo cargar la tasación')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [id])

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#ff007c]" />
      </div>
    )
  }

  if (error || !appraisal) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <p className="text-sm text-rose-600">{error ?? 'Tasación no encontrada'}</p>
        <button
          onClick={() => router.push('/tasaciones')}
          className="mt-4 rounded bg-[#ff007c] px-4 py-2 text-sm text-white"
        >
          Volver al listado
        </button>
      </div>
    )
  }

  return <EditorShell initial={appraisal} snapshot={snapshot} context="appraisal" />
}
