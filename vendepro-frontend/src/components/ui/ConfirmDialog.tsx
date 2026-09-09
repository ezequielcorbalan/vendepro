'use client'

import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Modal } from './Modal'
import { Button } from './Button'
import { Textarea } from './Input'
import { Text } from './Typography'

/**
 * Confirmación de una acción, con motivo opcional. Es el componente que el DS
 * manda usar antes de algo destructivo, y hasta el 04/09/2026 era el único
 * overlay del repo armado a mano: `fixed inset-0` propio, sin Portal, sin
 * scroll-lock, sin focus-trap y sin devolución de foco. El ratchet de overlays
 * no lo veía porque excluye `components/ui` — exclusión que tiene sentido para
 * colores (acá viven los reales) pero no para comportamiento.
 *
 * Ahora se apoya en `Modal`, así que hereda el contrato completo y está bajo
 * `overlayContract` como el resto.
 */
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
  const isDanger = variant === 'danger'

  return (
    <Modal
      open
      onClose={onCancel}
      title={title}
      icon={<AlertTriangle className="w-5 h-5" />}
      danger={isDanger}
      footer={
        <>
          <Button variant="ghost" onClick={onCancel}>{cancelLabel}</Button>
          <Button
            variant={isDanger ? 'danger' : 'primary'}
            onClick={() => onConfirm(reason)}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <Text size="sm" tone="muted" className="block whitespace-pre-line">{message}</Text>
      {requireReason && (
        <Textarea
          aria-label={reasonPlaceholder || 'Motivo'}
          rows={3}
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder={reasonPlaceholder}
          className="mt-3"
        />
      )}
    </Modal>
  )
}
