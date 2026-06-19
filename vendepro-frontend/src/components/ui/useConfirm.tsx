'use client'

import { useCallback, useRef, useState } from 'react'
import { ConfirmDialog, type ConfirmOptions } from './ConfirmDialog'

export interface ConfirmResult {
  confirmed: boolean
  reason: string
}

/**
 * Confirmación con la marca, basada en promesas. Reemplaza a `confirm()`/`prompt()`
 * nativos preservando el flujo imperativo:
 *
 *   const { confirmDialog, askConfirm } = useConfirm()
 *   const { confirmed, reason } = await askConfirm({ title, message })
 *   ...
 *   return <>{confirmDialog}{resto}</>
 */
export function useConfirm() {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null)
  const resolverRef = useRef<((r: ConfirmResult) => void) | null>(null)

  const askConfirm = useCallback((options: ConfirmOptions) => {
    setOpts(options)
    return new Promise<ConfirmResult>((resolve) => { resolverRef.current = resolve })
  }, [])

  const settle = useCallback((result: ConfirmResult) => {
    resolverRef.current?.(result)
    resolverRef.current = null
    setOpts(null)
  }, [])

  const confirmDialog = opts ? (
    <ConfirmDialog
      {...opts}
      onConfirm={(reason) => settle({ confirmed: true, reason })}
      onCancel={() => settle({ confirmed: false, reason: '' })}
    />
  ) : null

  return { confirmDialog, askConfirm }
}
