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
  onConsume: (saved: PendingPatches) => void
}

const DEBOUNCE_MS = 2000

function hasPending(p: PendingPatches): boolean {
  if (Object.keys(p.appraisal).length > 0) return true
  for (const v of Object.values(p.overrides)) if (Object.keys(v).length > 0) return true
  return false
}

export function useAutosave({ appraisalId, pending, onConsume }: Params) {
  const [status, setStatus] = useState<SaveStatus>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingRef = useRef<PendingPatches>(pending)
  const savingRef = useRef(false)
  const mountedRef = useRef(true)
  const [retryToken, setRetryToken] = useState(0)

  useEffect(() => { pendingRef.current = pending }, [pending])

  // `keepalive` lets the request survive page unload (tab close / navigation).
  // A normal fetch is cancelled on unload, so the last edit would be lost.
  const flush = useCallback(async (opts?: { keepalive?: boolean }) => {
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
    const keepalive = opts?.keepalive
    savingRef.current = true
    if (mountedRef.current) {
      setStatus('saving')
      setErrorMsg(null)
    }
    try {
      const tasks: Promise<unknown>[] = []
      if (hasAppraisal) tasks.push(updateAppraisal(appraisalId, snapshot.appraisal, { keepalive }))
      for (const [blockId, patch] of overrideEntries) {
        tasks.push(patchBlockOverride(appraisalId, blockId, patch, { keepalive }))
      }
      await Promise.all(tasks)
      if (mountedRef.current) {
        setStatus('saved')
        setLastSavedAt(Date.now())
        onConsume(snapshot)
      }
    } catch (e: any) {
      if (mountedRef.current) {
        setStatus('error')
        setErrorMsg(e?.message ?? 'Error desconocido')
      }
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
  // Lifecycle events that precede an unload use keepalive so the request is
  // not cancelled mid-flight; a plain blur (page stays alive) does not.
  useEffect(() => {
    const onBlur = () => { if (hasPending(pendingRef.current)) flush() }
    const onUnloadFlush = () => { if (hasPending(pendingRef.current)) flush({ keepalive: true }) }
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasPending(pendingRef.current)) {
        flush({ keepalive: true })
        e.preventDefault()
        e.returnValue = ''
      }
    }
    const onVisibility = () => { if (document.visibilityState === 'hidden') onUnloadFlush() }
    window.addEventListener('blur', onBlur)
    window.addEventListener('beforeunload', onBeforeUnload)
    window.addEventListener('pagehide', onUnloadFlush)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('blur', onBlur)
      window.removeEventListener('beforeunload', onBeforeUnload)
      window.removeEventListener('pagehide', onUnloadFlush)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [flush])

  // On unmount, mark unmounted (so in-flight saves don't setState) and fire a
  // final keepalive flush for any pending edits (e.g. client-side navigation).
  // Runs only on real unmount: it reads the latest flush via a ref so it does
  // not re-fire when flush's identity changes.
  const flushRef = useRef(flush)
  useEffect(() => { flushRef.current = flush }, [flush])
  useEffect(() => {
    return () => {
      mountedRef.current = false
      if (hasPending(pendingRef.current)) flushRef.current({ keepalive: true })
    }
  }, [])

  const retry = () => setRetryToken(n => n + 1)

  return { status, errorMsg, lastSavedAt, retry }
}
