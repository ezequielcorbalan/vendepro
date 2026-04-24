'use client'
import { useEffect, useRef, useState } from 'react'
import { updateAppraisal, patchBlockOverride } from '../shared/api'

export type SaveStatus = 'idle' | 'debouncing' | 'saving' | 'saved' | 'error'

interface PendingPatches {
  appraisal: Record<string, unknown>
  overrides: Record<string, Record<string, unknown>>
}

interface Params {
  appraisalId: string
  pending: PendingPatches
  dirty: boolean
  onConsume: (saved: PendingPatches) => void
}

const DEBOUNCE_MS = 2000

export function useAutosave({ appraisalId, pending, dirty, onConsume }: Params) {
  const [status, setStatus] = useState<SaveStatus>('idle')
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingRef = useRef<PendingPatches>(pending)
  const [retryToken, setRetryToken] = useState(0)

  useEffect(() => { pendingRef.current = pending }, [pending])

  useEffect(() => {
    if (!dirty) return
    setStatus('debouncing')
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(async () => {
      const snapshot: PendingPatches = {
        appraisal: { ...pendingRef.current.appraisal },
        overrides: Object.fromEntries(
          Object.entries(pendingRef.current.overrides).map(([k, v]) => [k, { ...v }])
        ),
      }
      const hasAppraisal = Object.keys(snapshot.appraisal).length > 0
      const overrideEntries = Object.entries(snapshot.overrides).filter(([, v]) => Object.keys(v).length > 0)
      if (!hasAppraisal && overrideEntries.length === 0) return
      setStatus('saving')
      try {
        const tasks: Promise<unknown>[] = []
        if (hasAppraisal) tasks.push(updateAppraisal(appraisalId, snapshot.appraisal))
        for (const [blockId, patch] of overrideEntries) {
          tasks.push(patchBlockOverride(appraisalId, blockId, patch))
        }
        await Promise.all(tasks)
        setStatus('saved')
        setLastSavedAt(Date.now())
        onConsume(snapshot)
      } catch {
        setStatus('error')
      }
    }, DEBOUNCE_MS)

    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [dirty, appraisalId, onConsume, retryToken])

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty) { e.preventDefault(); e.returnValue = '' }
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])

  const retry = () => setRetryToken(n => n + 1)

  return { status, lastSavedAt, retry }
}
