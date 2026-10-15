'use client'

import { useState } from 'react'
import { Send, Clock, Zap } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Textarea } from '@/components/ui/Input'
import { Text } from '@/components/ui/Typography'
import { Alert } from '@/components/ui/Alert'
import { useWhatsAppTemplates, renderWhatsAppTemplate } from '@/lib/whatsapp-templates'
import { RespuestasRapidas } from './RespuestasRapidas'
import { cn } from '@/lib/utils'
import { nombreCanal } from './canales'

/**
 * La caja de respuesta, con las respuestas rápidas de dos formas: el botón ⚡
 * y el atajo `/` — escribir "/seg" sugiere "Seguimiento", como en WhatsApp
 * Business y en Chatwoot. Elegir una pega el texto; no lo manda.
 */
interface CompositorProps {
  canal: string
  ventanaAbierta: boolean
  nombreContacto: string | null
  /** Dirección de la propiedad del lead, para {{direccion}}. */
  direccion?: string | null
  texto: string
  onTexto: (t: string) => void
  onEnviar: () => void
  enviando: boolean
  puedeConfigurar: boolean
}

const MAX_SUGERENCIAS = 6

/** "Coordinar visita" se encuentra con "/coord" o "/visita", sin tildes ni mayúsculas. */
function normalizar(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

export function Compositor({
  canal, ventanaAbierta, nombreContacto, direccion, texto, onTexto, onEnviar, enviando, puedeConfigurar,
}: CompositorProps) {
  const { templates, orgName } = useWhatsAppTemplates()
  const [indice, setIndice] = useState(0)
  const contexto = { name: nombreContacto, address: direccion }

  // El atajo vale mientras lo escrito sea "/algo" en una sola palabra.
  const atajo = /^\/(\S*)$/.exec(texto)
  const sugerencias = atajo
    ? templates.filter(t => normalizar(t.name).includes(normalizar(atajo[1] ?? ''))).slice(0, MAX_SUGERENCIAS)
    : []
  const elegida = sugerencias[Math.min(indice, sugerencias.length - 1)]

  const usar = (body: string) => {
    onTexto(renderWhatsAppTemplate(body, contexto, { orgName }))
    setIndice(0)
  }

  const teclas = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (sugerencias.length === 0) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setIndice(i => (i + 1) % sugerencias.length) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setIndice(i => (i - 1 + sugerencias.length) % sugerencias.length) }
    if ((e.key === 'Enter' || e.key === 'Tab') && elegida) { e.preventDefault(); usar(elegida.body) }
    if (e.key === 'Escape') { e.preventDefault(); onTexto('') }
  }

  return (
    <div className="border-t border-gray-100 p-3 space-y-2">
      {!ventanaAbierta && (
        <Alert tone="warning" hideIcon>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-warning shrink-0" />
            <Text size="xs">
              {canal === 'whatsapp'
                ? 'Pasaron más de 24 h desde el último mensaje del cliente. Con la API oficial de WhatsApp sólo se podría responder con una plantilla aprobada.'
                : `Pasaron más de 24 h desde el último mensaje del cliente: ${nombreCanal(canal)} no deja responderle hasta que vuelva a escribir.`}
            </Text>
          </div>
        </Alert>
      )}

      {sugerencias.length > 0 && (
        /* ds-todo: candidato a variante "lista de sugerencias" (autocompletar
           anclado a un campo); el Dropdown del DS se abre sólo con click. */
        <Card padded={false} className="overflow-hidden" role="listbox" aria-label="Respuestas rápidas">
          {sugerencias.map(t => (
            <Button
              key={t.id}
              variant="ghost"
              role="option"
              aria-selected={t.id === elegida?.id}
              onMouseDown={e => { e.preventDefault(); usar(t.body) }}
              className={cn('w-full h-auto justify-start gap-2 rounded-none px-3 py-2 text-left', t.id === elegida?.id && 'bg-primary/5')}
              icon={<Zap className="w-3.5 h-3.5 text-primary" />}
            >
              <span className="font-medium text-sm text-ink">{t.name}</span>
              <span className="text-xs text-gray-500 truncate">{renderWhatsAppTemplate(t.body, contexto, { orgName })}</span>
            </Button>
          ))}
        </Card>
      )}

      <div className="flex items-end gap-2">
        <RespuestasRapidas nombre={nombreContacto} direccion={direccion} onElegir={onTexto} puedeConfigurar={puedeConfigurar} />
        <Textarea
          rows={2}
          placeholder="Escribí tu respuesta… (/ para respuestas rápidas)"
          value={texto}
          onChange={e => { onTexto(e.target.value); setIndice(0) }}
          onKeyDown={teclas}
          className="flex-1"
        />
        <Button onClick={onEnviar} loading={enviando} disabled={!texto.trim() || !!atajo} icon={<Send className="w-3.5 h-3.5" />}>
          Enviar
        </Button>
      </div>
    </div>
  )
}
