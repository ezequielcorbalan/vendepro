'use client'

import { MessageCircle, Send } from 'lucide-react'
import { formatWhatsApp } from '@/lib/crm-config'
import {
  renderWhatsAppTemplate,
  type WhatsAppTemplate,
  type WhatsAppTemplateContext,
} from '@/lib/whatsapp-templates'
import { Modal } from './Modal'
import { Text } from './Typography'

/**
 * Elegir el mensaje antes de abrir el chat. Es el paso 2 del botón de
 * WhatsApp: click en WhatsApp → click en el mensaje → se abre wa.me con el
 * texto ya escrito.
 *
 * Modal (y no popover) a propósito: el botón vive dentro de tarjetas de lista
 * y de columnas de kanban con overflow, donde un menú anclado se recorta o
 * queda fuera de pantalla en mobile.
 */
interface WhatsAppTemplatePickerProps {
  open: boolean
  onClose: () => void
  phone: string
  templates: WhatsAppTemplate[]
  context: WhatsAppTemplateContext
  orgName?: string | null
  /** Se dispara al abrir el chat (ej. registrar la actividad en el CRM). */
  onSend?: () => void
}

export function WhatsAppTemplatePicker({
  open, onClose, phone, templates, context, orgName, onSend,
}: WhatsAppTemplatePickerProps) {
  const openChat = (message?: string) => {
    const href = `https://wa.me/${formatWhatsApp(phone)}${message ? `?text=${encodeURIComponent(message)}` : ''}`
    window.open(href, '_blank', 'noopener,noreferrer')
    onSend?.()
    onClose()
  }

  const who = context.name?.trim()

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Enviar WhatsApp"
      icon={<MessageCircle className="w-4 h-4" />}
      className="max-w-lg"
    >
      <div className="space-y-3">
        <Text size="xs" tone="muted">
          {who ? <>Elegí el mensaje para <span className="font-medium text-ink">{who}</span>.</> : 'Elegí el mensaje.'}
        </Text>

        <div className="space-y-2 max-h-[50vh] overflow-y-auto -mx-1 px-1">
          {templates.map(t => {
            const message = renderWhatsAppTemplate(t.body, context, { orgName })
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => openChat(message)}
                className="w-full text-left p-3 rounded-card border border-gray-200 hover:border-whatsapp hover:bg-success/5 transition-colors"
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <Text size="sm" weight="semibold">{t.name}</Text>
                  <Send className="w-3.5 h-3.5 text-whatsapp shrink-0" />
                </div>
                <Text size="xs" tone="muted" className="line-clamp-3 whitespace-pre-wrap">{message}</Text>
              </button>
            )
          })}
        </div>

        <button
          type="button"
          onClick={() => openChat()}
          className="w-full text-center py-2 text-xs font-medium text-gray-500 hover:text-primary transition-colors"
        >
          Abrir el chat sin mensaje
        </button>
      </div>
    </Modal>
  )
}
