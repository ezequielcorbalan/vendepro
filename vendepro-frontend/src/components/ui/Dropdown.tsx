'use client'

import { useState, useEffect, cloneElement, isValidElement, type ReactNode, type ReactElement, type MouseEvent } from 'react'
import { cn } from '@/lib/utils'
import { Z } from '@/lib/z'

/**
 * Dropdown / menú contextual del design system. Maneja su propio estado abierto,
 * cierra al clickear afuera o con Esc. El trigger debe ser un elemento
 * interactivo (ej. <Button>): se le inyecta onClick + aria-haspopup/expanded vía
 * cloneElement, así queda accesible por teclado sin botones anidados.
 */
interface DropdownProps {
  /** Disparador interactivo (ej. un Button). */
  trigger: ReactElement<{ onClick?: (e: MouseEvent) => void }>
  children: ReactNode
  align?: 'left' | 'right'
  className?: string
}

export function Dropdown({ trigger, children, align = 'left', className }: DropdownProps) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  const triggerEl = isValidElement(trigger)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ? cloneElement(trigger, {
        onClick: (e: MouseEvent) => { trigger.props.onClick?.(e); setOpen(o => !o) },
        'aria-haspopup': 'menu',
        'aria-expanded': open,
      } as any)
    : trigger

  return (
    <div className="relative inline-flex">
      {triggerEl}
      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 cursor-default"
            style={{ zIndex: Z.dropdown - 1 }}
            aria-hidden
            tabIndex={-1}
            onClick={() => setOpen(false)}
          />
          <div
            role="menu"
            onClick={() => setOpen(false)}
            style={{ zIndex: Z.dropdown }}
            className={cn(
              'absolute top-full mt-2 min-w-[200px]',
              'bg-white border border-gray-200 rounded-card shadow-pop p-1.5',
              align === 'right' ? 'right-0' : 'left-0',
              className,
            )}
          >
            {children}
          </div>
        </>
      )}
    </div>
  )
}

interface DropdownItemProps {
  children: ReactNode
  icon?: ReactNode
  danger?: boolean
  onClick?: () => void
}

export function DropdownItem({ children, icon, danger = false, onClick }: DropdownItemProps) {
  return (
    <button
      role="menuitem"
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-2.5 px-2.5 py-2 rounded-control text-sm text-left transition-colors',
        danger ? 'text-danger hover:bg-danger/5' : 'text-gray-700 hover:bg-gray-100',
      )}
    >
      {icon}
      {children}
    </button>
  )
}

export function DropdownSeparator() {
  return <div className="h-px bg-gray-100 my-1.5 mx-1" />
}
