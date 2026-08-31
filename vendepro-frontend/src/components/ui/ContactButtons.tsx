'use client'

import { Phone, MessageCircle } from 'lucide-react'
import { formatWhatsApp } from '@/lib/crm-config'
import { useInActionMenu } from '@/components/ui/action-menu'
import { cn } from '@/lib/utils'

/**
 * Botones de canal de contacto del design system. Encapsulan la decisión de
 * cómo se ve/comporta cada canal (color, ícono, link) en UN SOLO lugar: si
 * cambia la decisión, se actualiza en toda la app.
 * - CallButton: link tel:, color primario.
 * - WhatsAppButton: link wa.me (arma el número con formatWhatsApp), verde WhatsApp.
 * `iconOnly` lo vuelve un ícono cuadrado (misma decisión, otra forma).
 *
 * Dentro del menú de tres puntos de un `ActionGroup` se dibujan como opción:
 * fondo transparente y texto gris, con el ícono en el color del canal para que
 * siga reconociéndose de un vistazo.
 */
const BASE = 'inline-flex items-center justify-center gap-1.5 rounded-control text-sm font-medium transition-opacity hover:opacity-90'
const SHAPE = { labeled: 'px-4 py-2', icon: 'w-9 h-9' }
const OFF = 'opacity-40 cursor-not-allowed pointer-events-none'
// Forma de opción de menú: ocupa el ancho, alinea a la izquierda y no tiñe el fondo.
const IN_MENU = 'w-full justify-start gap-2.5 px-2.5 py-2 text-gray-700 hover:bg-gray-100'

interface ChannelProps {
  phone?: string | null
  onClick?: () => void
  /** Ícono cuadrado sin etiqueta. */
  iconOnly?: boolean
  className?: string
}

export function CallButton({ phone, onClick, iconOnly = false, className }: ChannelProps) {
  const inMenu = useInActionMenu()
  const cls = cn(
    BASE,
    inMenu ? IN_MENU : cn(iconOnly ? SHAPE.icon : SHAPE.labeled, 'bg-primary text-white'),
    className,
  )
  const content = (
    <>
      <Phone className={cn('w-4 h-4', inMenu && 'text-primary')} />
      {(!iconOnly || inMenu) && <span>Llamar</span>}
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
}

export function WhatsAppButton({ phone, message, onClick, iconOnly = false, className }: WhatsAppProps) {
  const inMenu = useInActionMenu()
  const cls = cn(
    BASE,
    inMenu ? IN_MENU : cn(iconOnly ? SHAPE.icon : SHAPE.labeled, 'bg-whatsapp text-white'),
    className,
  )
  const content = (
    <>
      <MessageCircle className={cn('w-4 h-4', inMenu && 'text-whatsapp')} />
      {(!iconOnly || inMenu) && <span>WhatsApp</span>}
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
