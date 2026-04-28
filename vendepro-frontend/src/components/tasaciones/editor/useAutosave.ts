'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
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

function hasPending(p: PendingPatches): boolean {
  if (Object.keys(p.appraisal).length > 0) return true
  for (const v of Object.values(p.overrides)) if (Object.keys(v).length > 0) return true
  return false
}

export function useAutosave({ appraisalId, pending, dirty, onConsume }: Params) {
  const [status, setStatus] = useState<SaveStatus>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingRef = useRef<PendingPatches>(pending)
  const savingRef = useRef(false)
  const [retryToken, setRetryToken] = useState(0)

  useEffect(() => { pendingRef.current = pending }, [pending])

  const flush = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    if (savingRef.current) return
    const snapshot: PendingPatches = {
      appraisal: { ...pendingRef.current.appraisal },
      overrides: Object.fromEntries(
        Object.entries(pendingRef.current.overrides).map(([k, v]) => [k, { ...v }])
      ),
    }
    const hasAppraisal = Object.keys(snapshot.appraisal).length > 0
    const overrideEntries = Object.entries(snapshot.overrides).filter(([, v]) => Object.keys(v).length > 0)
    if (!hasAppraisal && overrideEntries.length === 0) return
    savingRef.current = true
    setStatus('saving')
    setErrorMsg(null)
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
    } catch (e: any) {
      setStatus('error')
      setErrorMsg(e?.message ?? 'Error desconocido')
    } finally {
      savingRef.current = false
    }
  }, [appraisalId, onConsume])

  // Debounce: every change to `pending` resets the 2s timer. We watch `pending`
  // by reference so the effect re-fires after consume too — if changes piled
  // up during a save, the next save schedules automatically.
  useEffect(() => {
    if (!hasPending(pending)) return
    setStatus('debouncing')
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => { flush() }, DEBOUNCE_MS)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [pending, flush, retryToken])

  // Flush on focus loss / page hide / beforeunload to avoid losing the last
  // 2 seconds of edits when the user navigates, switches tabs, or closes.
  useEffect(() => {
    const onFlush = () => { if (hasPending(pendingRef.current)) flush() }
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasPending(pendingRef.current)) {
        flush()
        e.preventDefault()
        e.returnValue = ''
      }
    }
    const onVisibility = () => { if (document.visibilityState === 'hidden') onFlush() }
    window.addEventListener('blur', onFlush)
    window.addEventListener('beforeunload', onBeforeUnload)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('blur', onFlush)
      window.removeEventListener('beforeunload', onBeforeUnload)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [flush])

  const retry = () => setRetryToken(n => n + 1)

  return { status, errorMsg, lastSavedAt, retry }
}
