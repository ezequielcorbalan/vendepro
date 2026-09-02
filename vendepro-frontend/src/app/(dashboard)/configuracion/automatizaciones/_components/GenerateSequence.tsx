'use client'

import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input, Textarea, Select, Field } from '@/components/ui/Input'
import { Alert } from '@/components/ui/Alert'
import { Heading, Text } from '@/components/ui/Typography'
import { useToast } from '@/components/ui/Toast'
import type { DraftAction } from './ActionsEditor'

/**
 * Generación de una secuencia de emails con IA.
 *
 * Viene del módulo viejo de secuencias drip (`/marketing/automations`), que
 * este motor reemplaza. La diferencia de modelo está acá: la IA devuelve
 * `delay_hours` RELATIVO al paso anterior, y las acciones usan minutos
 * ABSOLUTOS desde el disparo — por eso se acumula.
 *
 * La IA nunca activa ni envía nada: el resultado es siempre un borrador que el
 * usuario revisa y edita.
 */

/** Tope del dominio (`MAX_DELAY_MINUTES`): 180 días. */
const MAX_DELAY_MINUTES = 180 * 24 * 60

interface GenerateSequenceProps {
  /** Reemplaza las acciones actuales por la secuencia generada. */
  onGenerated: (actions: DraftAction[]) => void
  /** true si ya hay acciones cargadas — se avisa que se van a reemplazar. */
  hasActions: boolean
}

export function GenerateSequence({ onGenerated, hasActions }: GenerateSequenceProps) {
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [brief, setBrief] = useState('')
  const [audience, setAudience] = useState('')
  const [stepCount, setStepCount] = useState(3)
  const [generating, setGenerating] = useState(false)

  const generate = async () => {
    if (brief.trim().length < 10) {
      toast('Contanos el objetivo de la secuencia (al menos una frase)', 'error')
      return
    }
    setGenerating(true)
    try {
      const res = await apiFetch('ai', '/generate-email-sequence', {
        method: 'POST',
        body: JSON.stringify({
          brief: brief.trim(),
          step_count: stepCount,
          audience_description: audience.trim() || null,
        }),
      })
      const data = (await res.json()) as any
      if (!res.ok || !Array.isArray(data.steps)) {
        throw new Error(data?.error || 'La IA no pudo generar la secuencia')
      }

      let cumulativeHours = 0
      const actions: DraftAction[] = data.steps.map((step: any, i: number) => {
        // El primer paso sale con el disparo; los siguientes traen su espera
        // relativa, que se acumula para obtener la absoluta.
        const relative = typeof step.delay_hours === 'number' ? step.delay_hours : (i === 0 ? 0 : 72)
        cumulativeHours += i === 0 ? 0 : relative
        return {
          key: `ai-${Date.now()}-${i}`,
          action_type: 'send_email',
          action_config: {
            subject: step.subject ?? '',
            body_html: step.html ?? '',
            include_unsubscribe: true,
            reply_to_agent: true,
          },
          delay_minutes: Math.min(Math.round(cumulativeHours * 60), MAX_DELAY_MINUTES),
        }
      })

      onGenerated(actions)
      setOpen(false)
      toast('Secuencia generada — revisá y editá cada email antes de activarla')
    } catch (e: any) {
      // Sin este log la consola sale limpia aunque el endpoint este caido, y
      // diagnosticar obliga a mirar la red. Paso con la ANTHROPIC_API_KEY
      // faltante: cuatro features muertas y cero rastro en consola.
      console.error('[generate-email-sequence] fallo la generacion:', e)
      toast(e?.message || 'Error generando con IA', 'error')
    }
    setGenerating(false)
  }

  if (!open) {
    return (
      <Button
        variant="outline"
        icon={<Sparkles className="w-4 h-4" />}
        onClick={() => setOpen(true)}
      >
        Generar secuencia con IA
      </Button>
    )
  }

  return (
    <Card>
      <Heading level={4} className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-gray-600" aria-hidden /> Generar secuencia con IA
      </Heading>
      <Text size="sm" tone="muted" className="mt-1">
        La IA escribe los emails y propone cuánto esperar entre uno y otro. Siempre queda como
        borrador editable: no se activa ni se envía nada.
      </Text>

      {hasActions && (
        <Alert tone="warning" className="mt-3">
          Ya tenés acciones cargadas. Generar una secuencia las reemplaza por completo.
        </Alert>
      )}

      <div className="mt-4 space-y-4">
        <Field label="Objetivo de la secuencia" required>
          <Textarea
            value={brief}
            placeholder="Acompañar a un propietario que pidió una tasación hasta que firme la autorización de venta"
            onChange={e => setBrief(e.target.value)}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="A quién le escribimos" hint="Opcional, ayuda a afinar el tono">
            <Input
              value={audience}
              placeholder="Propietarios de casas en zona norte"
              onChange={e => setAudience(e.target.value)}
            />
          </Field>
          <Field label="Cantidad de emails">
            <Select value={String(stepCount)} onChange={e => setStepCount(Number(e.target.value))}>
              {[2, 3, 4, 5, 6].map(n => (
                <option key={n} value={n}>{n} emails</option>
              ))}
            </Select>
          </Field>
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        <Button loading={generating} onClick={generate}>Generar</Button>
        <Button variant="ghost" disabled={generating} onClick={() => setOpen(false)}>Cancelar</Button>
      </div>
    </Card>
  )
}
