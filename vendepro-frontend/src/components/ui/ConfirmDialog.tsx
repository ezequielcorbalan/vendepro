'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, X } from 'lucide-react'

export interface ConfirmOptions {
  title: string
  /** Cuerpo del mensaje; respeta saltos de línea (\n). */
  message: string
  confirmLabel?: string
  cancelLabel?: string
  /** 'danger' pinta el botón de confirmar en rojo (acciones destructivas). */
  variant?: 'default' | 'danger'
  /** Si es true, muestra un textarea y devuelve el texto ingresado como `reason`. */
  requireReason?: boolean
  reasonPlaceholder?: string
}

interface ConfirmDialogProps extends ConfirmOptions {
  onConfirm: (reason: string) => void
  onCancel: () => void
}

export function ConfirmDialog({
  title, message, confirmLabel = 'Confirmar', cancelLabel = 'Cancelar',
  variant = 'default', requireReason = false, reasonPlaceholder = '',
  onConfirm, onCancel,
}: ConfirmDialogProps) {
  const [reason, setReason] = useState('')

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  const isDanger = variant === 'danger'

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="bg-white rounded-card w-full max-w-md shadow-pop overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between px-6 pt-5 pb-3 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-card flex items-center justify-center shrink-0 ${
              isDanger ? 'bg-danger/10' : 'bg-brand-gradient'
            }`}>
              <AlertTriangle className={`w-4.5 h-4.5 ${isDanger ? 'text-danger' : 'text-white'}`} />
            </div>
            <h2 className="text-lg font-semibold text-ink leading-tight">{title}</h2>
          </div>
          <button onClick={onCancel} aria-label="Cerrar" className="p-1.5 hover:bg-gray-100 rounded-control shrink-0">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="px-6 py-4">
          <p className="text-sm text-gray-600 whitespace-pre-line">{message}</p>
          {requireReason && (
            <textarea
              autoFocus
              rows={3}
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder={reasonPlaceholder}
              className="mt-3 w-full border border-gray-200 rounded-card px-3 py-2 text-sm focus:outline-none"
            />
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 bg-gray-50 border-t border-gray-100">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-full text-sm font-medium text-gray-700 hover:bg-gray-200 transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            onClick={() => onConfirm(reason)}
            className={`px-5 py-2 rounded-full text-sm font-semibold text-white transition-colors ${
              isDanger ? 'bg-danger hover:opacity-90' : 'bg-primary hover:bg-primary-hover'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
