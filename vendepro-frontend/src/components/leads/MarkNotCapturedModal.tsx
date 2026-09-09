'use client'

import { useEffect, useState } from 'react'
import { XCircle } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Field, Input, Textarea } from '@/components/ui/Input'
import { PillRadioGroup } from '@/components/ui/ChoicePills'
import { Text } from '@/components/ui/Typography'
import { LEAD_RECONTACT_OPTIONS, recontactDateIn } from '@/lib/crm-config'

export interface NotCapturedResult {
  /** Motivo, va a las notas del cambio de etapa (y a stage_history). */
  reason: string
  /** ISO yyyy-mm-dd, o null si el agente eligió "No recontactar". */
  recontactDate: string | null
}

interface MarkNotCapturedModalProps {
  open: boolean
  /** Nombre del lead, sólo para el copy del modal. */
  leadName?: string
  saving?: boolean
  onClose: () => void
  onConfirm: (result: NotCapturedResult) => void
}

/**
 * Cierre de un lead vendedor que no se captó.
 *
 * No es un `askConfirm` porque acá el motivo no alcanza: un no captado se
 * retoma. El agente elige cuándo, y esa fecha queda en `next_step_date` para
 * que la card la muestre cuando filtra por cerrados. El recordatorio en el
 * calendario lo agenda la automatización `recontacto_no_captado` de la org.
 */
export function MarkNotCapturedModal({ open, leadName, saving = false, onClose, onConfirm }: MarkNotCapturedModalProps) {
  const [reason, setReason] = useState('')
  const [when, setWhen] = useState<string>('1m')
  const [customDate, setCustomDate] = useState('')

  // Cada apertura arranca limpia: si no, el motivo del lead anterior queda escrito.
  useEffect(() => {
    if (open) { setReason(''); setWhen('1m'); setCustomDate('') }
  }, [open])

  const resolveDate = (): string | null => {
    const opt = LEAD_RECONTACT_OPTIONS.find(o => o.key === when)
    if (!opt || opt.key === 'none') return null
    if (opt.key === 'custom') return customDate || null
    return recontactDateIn(opt.days as number)
  }

  const blocked = saving || (when === 'custom' && !customDate)

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Marcar como no captado"
      icon={<XCircle className="w-5 h-5" />}
      danger
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button
            variant="danger"
            loading={saving}
            disabled={blocked}
            onClick={() => onConfirm({ reason: reason.trim(), recontactDate: resolveDate() })}
          >
            Marcar no captado
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Text size="sm" tone="muted">
          {leadName ? `${leadName} sale del pipeline.` : 'El lead sale del pipeline.'} Se puede retomar más adelante:
          el propietario que hoy no te eligió puede seguir queriendo vender en unos meses.
        </Text>

        <Field label="¿Por qué no se captó?" hint="Ej: eligió otra inmobiliaria, no acordamos el precio, decidió no vender.">
          <Textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="Motivo (opcional)"
            rows={3}
          />
        </Field>

        <PillRadioGroup
          label="Recontactar"
          hint="Queda como próximo paso del lead."
          options={LEAD_RECONTACT_OPTIONS.map(o => ({ value: o.key, label: o.label }))}
          value={when}
          onChange={setWhen}
        />

        {when === 'custom' && (
          <Field label="Fecha de recontacto" htmlFor="nc-date" required>
            <Input
              id="nc-date"
              type="date"
              value={customDate}
              onChange={e => setCustomDate(e.target.value)}
            />
          </Field>
        )}
      </div>
    </Modal>
  )
}
