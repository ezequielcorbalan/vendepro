'use client'

import { useState, useEffect } from 'react'
import { UserPlus } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Field, Select, Textarea } from '@/components/ui/Input'
import { Text } from '@/components/ui/Typography'
import { Alert } from '@/components/ui/Alert'

export interface DelegateResult {
  toAgentName: string
  notified: boolean
  emailed: boolean
  emailSkipped?: string
  /** Cuántos leads se movieron de verdad (en lote puede ser menos que los pedidos). */
  assigned: number
  /** Los que no se pudieron mover: ajenos o inexistentes. */
  failed: number
  /** Los que ya eran de ese agente. */
  unchanged: number
}

interface DelegateLeadModalProps {
  open: boolean
  onClose: () => void
  /** Uno (desde la ficha) o varios (reparto en lote desde la lista). */
  leadIds: string[]
  /** Cómo nombrar lo que se delega: "Elba Sabbatini" o "7 leads". */
  leadLabel: string
  /** Agente actual, para no ofrecerlo. Sólo cuando se delega un lead solo. */
  currentAgentId?: string | null
  onDelegated: (result: DelegateResult) => void
}

/**
 * Delegar un lead a otro agente. Es su propio modal y no un campo más del
 * formulario de edición porque delegar no es editar: le avisa a una persona
 * que ahora tiene trabajo, y eso merece confirmación explícita y un lugar
 * donde escribirle qué tiene que hacer.
 */
export function DelegateLeadModal({ open, onClose, leadIds, leadLabel, currentAgentId, onDelegated }: DelegateLeadModalProps) {
  const [agents, setAgents] = useState<any[]>([])
  const [agentId, setAgentId] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setAgentId('')
    setNote('')
    setError(null)
    apiFetch('admin', '/agents')
      .then(r => r.json() as Promise<any>)
      .then(d => setAgents(Array.isArray(d) ? d : []))
      .catch(() => setAgents([]))
  }, [open])

  const handleDelegate = async () => {
    if (!agentId) return
    setSaving(true)
    setError(null)
    const varios = leadIds.length > 1
    try {
      const res = await apiFetch('crm', '/leads/assign', {
        method: 'POST',
        // Un lead va como `id` para que un problema vuelva como error HTTP con
        // su mensaje; en lote va como `ids` y el backend reporta lead por lead.
        body: JSON.stringify({
          ...(varios ? { ids: leadIds } : { id: leadIds[0] }),
          assigned_to: agentId,
          note: note.trim() || null,
        }),
      })
      const data = (await res.json()) as any
      if (!res.ok || data.error) {
        setError(data.error ?? 'No se pudo delegar')
        setSaving(false)
        return
      }
      onDelegated({
        toAgentName: agents.find(a => a.id === agentId)?.full_name ?? 'el agente',
        notified: data.notified === true,
        emailed: data.emailed === true,
        emailSkipped: data.emailSkipped,
        assigned: varios ? (data.assigned?.length ?? 0) : (data.unchanged ? 0 : 1),
        failed: varios ? (data.failed?.length ?? 0) : 0,
        unchanged: varios ? (data.unchanged?.length ?? 0) : (data.unchanged ? 1 : 0),
      })
      onClose()
    } catch {
      setError('Error de conexión')
    }
    setSaving(false)
  }

  const candidates = agents.filter(a => a.id !== currentAgentId)

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={leadIds.length > 1 ? 'Repartir leads' : 'Delegar lead'}
      icon={<UserPlus className="w-5 h-5" />}
      sheet
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={handleDelegate} loading={saving} disabled={!agentId}>
            {leadIds.length > 1 ? `Delegar ${leadIds.length} y avisar` : 'Delegar y avisar'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Text size="sm" tone="muted">
          {leadLabel} {leadIds.length > 1 ? 'pasan' : 'pasa'} a manos del agente que elijas.
          Le llega un solo aviso con el link.
        </Text>

        {error && <Alert tone="danger">{error}</Alert>}

        <Field label="Agente" required>
          <Select value={agentId} onChange={e => setAgentId(e.target.value)}>
            <option value="">Elegí un agente...</option>
            {candidates.map(a => <option key={a.id} value={a.id}>{a.full_name}</option>)}
          </Select>
        </Field>

        {candidates.length === 0 && (
          <Alert tone="warning">No hay otros agentes activos en la inmobiliaria.</Alert>
        )}

        <Field label="Instrucción" hint="Opcional. Viaja en el aviso que recibe el agente.">
          <Textarea
            rows={3}
            placeholder="Ej: llamalo hoy, pidió tasación para la semana que viene"
            value={note}
            onChange={e => setNote(e.target.value)}
          />
        </Field>
      </div>
    </Modal>
  )
}
