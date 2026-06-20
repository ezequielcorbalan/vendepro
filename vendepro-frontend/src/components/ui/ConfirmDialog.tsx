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
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between px-6 pt-5 pb-3 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
              isDanger ? 'bg-red-100' : 'bg-gradient-to-br from-brand-pink to-brand-orange'
            }`}>
              <AlertTriangle className={`w-4.5 h-4.5 ${isDanger ? 'text-red-600' : 'text-white'}`} />
            </div>
            <h2 className="text-lg font-semibold text-gray-900 leading-tight">{title}</h2>
          </div>
          <button onClick={onCancel} aria-label="Cerrar" className="p-1.5 hover:bg-gray-100 rounded-lg shrink-0">
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
              className="mt-3 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-pink"
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
              isDanger ? 'bg-red-600 hover:bg-red-700' : 'bg-brand-pink hover:bg-[#e60070]'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
