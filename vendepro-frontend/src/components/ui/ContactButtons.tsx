'use client'

import { useState } from 'react'
import { Phone, MessageCircle } from 'lucide-react'
import { formatWhatsApp } from '@/lib/crm-config'
import { useWhatsAppTemplates, type WhatsAppTemplateContext } from '@/lib/whatsapp-templates'
import { cn } from '@/lib/utils'
import { WhatsAppTemplatePicker } from './WhatsAppTemplatePicker'

/**
 * Botones de canal de contacto del design system. Encapsulan la decisión de
 * cómo se ve/comporta cada canal (color, ícono, link) en UN SOLO lugar: si
 * cambia la decisión, se actualiza en toda la app.
 * - CallButton: link tel:, color primario.
 * - WhatsAppButton: link wa.me (arma el número con formatWhatsApp), verde WhatsApp.
 * `iconOnly` lo vuelve un ícono cuadrado (misma decisión, otra forma).
 */
const BASE = 'inline-flex items-center justify-center gap-1.5 rounded-control text-sm font-medium transition-opacity hover:opacity-90'
const SHAPE = { labeled: 'px-4 py-2', icon: 'w-9 h-9' }
const OFF = 'opacity-40 cursor-not-allowed pointer-events-none'

interface ChannelProps {
  phone?: string | null
  onClick?: () => void
  /** Ícono cuadrado sin etiqueta. */
  iconOnly?: boolean
  className?: string
}

export function CallButton({ phone, onClick, iconOnly = false, className }: ChannelProps) {
  const cls = cn(BASE, iconOnly ? SHAPE.icon : SHAPE.labeled, 'bg-primary text-white', className)
  const content = (
    <>
      <Phone className="w-4 h-4" />
      {!iconOnly && <span>Llamar</span>}
    </>
  )
  if (!phone) {
    return <button type="button" disabled className={cn(cls, OFF)} aria-label="Llamar">{content}</button>
  }
  return (
    <a href={`tel:${phone}`} onClick={onClick} className={cls} aria-label="Llamar">{content}</a>
  )
}

interface WhatsAppProps extends ChannelProps {
  /** Texto pre-cargado en el chat. Fijo: saltea el selector de mensajes. */
  message?: string
  /**
   * Datos del lead/contacto del otro lado del chat. Pasarlo activa el selector
   * de mensajes predeterminados de la org (si hay alguno cargado): en vez de
   * abrir WhatsApp vacío, el agente elige el texto y sale escrito.
   */
  templateContext?: WhatsAppTemplateContext
}

export function WhatsAppButton({ phone, message, templateContext, onClick, iconOnly = false, className }: WhatsAppProps) {
  const { templates, orgName } = useWhatsAppTemplates()
  const [pickerOpen, setPickerOpen] = useState(false)

  const cls = cn(BASE, iconOnly ? SHAPE.icon : SHAPE.labeled, 'bg-whatsapp text-white', className)
  const content = (
    <>
      <MessageCircle className="w-4 h-4" />
      {!iconOnly && <span>WhatsApp</span>}
    </>
  )
  if (!phone) {
    return <button type="button" disabled className={cn(cls, OFF)} aria-label="WhatsApp">{content}</button>
  }

  // Un `message` explícito manda; sin plantillas cargadas (o sin contexto) el
  // botón se comporta como siempre: link directo al chat vacío.
  const usePicker = !message && !!templateContext && templates.length > 0
  if (usePicker) {
    return (
      <>
        <button type="button" onClick={() => setPickerOpen(true)} className={cls} aria-label="WhatsApp">{content}</button>
        <WhatsAppTemplatePicker
          open={pickerOpen}
          onClose={() => setPickerOpen(false)}
          phone={phone}
          templates={templates}
          context={templateContext}
          orgName={orgName}
          onSend={onClick}
        />
      </>
    )
  }

  const href = `https://wa.me/${formatWhatsApp(phone)}${message ? `?text=${encodeURIComponent(message)}` : ''}`
  return (
    <a href={href} target="_blank" rel="noreferrer" onClick={onClick} className={cls} aria-label="WhatsApp">{content}</a>
  )
}
