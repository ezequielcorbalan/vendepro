'use client'

import { Phone, MessageCircle } from 'lucide-react'
import { formatWhatsApp } from '@/lib/crm-config'
import { cn } from '@/lib/utils'

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
  /** Texto pre-cargado en el chat. */
  message?: string
  /** Etiqueta del botón (ej. el `button_label` configurable de un bloque de landing). Default: "WhatsApp". */
  label?: string
}

export function WhatsAppButton({ phone, message, onClick, iconOnly = false, className, label }: WhatsAppProps) {
  const cls = cn(BASE, iconOnly ? SHAPE.icon : SHAPE.labeled, 'bg-whatsapp text-white', className)
  const content = (
    <>
      <MessageCircle className="w-4 h-4" />
      {!iconOnly && <span>{label || 'WhatsApp'}</span>}
    </>
  )
  if (!phone) {
    return <button type="button" disabled className={cn(cls, OFF)} aria-label="WhatsApp">{content}</button>
  }
  const href = `https://wa.me/${formatWhatsApp(phone)}${message ? `?text=${encodeURIComponent(message)}` : ''}`
  return (
    <a href={href} target="_blank" rel="noreferrer" onClick={onClick} className={cls} aria-label="WhatsApp">{content}</a>
  )
}
