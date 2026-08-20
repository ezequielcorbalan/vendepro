'use client'

import { useState, useEffect, useRef, useCallback, cloneElement, isValidElement, type ReactNode, type ReactElement, type MouseEvent } from 'react'
import { cn } from '@/lib/utils'
import { Z } from '@/lib/z'
import { Portal } from './Portal'

/**
 * Dropdown / menú contextual del design system. Maneja su propio estado abierto,
 * cierra al clickear afuera o con Esc. El trigger debe ser un elemento
 * interactivo (ej. <Button>): se le inyecta onClick + aria-haspopup/expanded vía
 * cloneElement, así queda accesible por teclado sin botones anidados.
 *
 * El panel se monta en un Portal y se posiciona en coordenadas de viewport, así
 * no lo recorta un ancestro con overflow (el sidebar, una card) ni queda debajo
 * de un hermano por el stacking context. Se reposiciona en scroll y resize.
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
  const anchorRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left?: number; right?: number }>({ top: 0 })

  const place = useCallback(() => {
    const rect = anchorRef.current?.getBoundingClientRect()
    if (!rect) return
    setPos(
      align === 'right'
        ? { top: rect.bottom + 8, right: Math.max(8, window.innerWidth - rect.right) }
        : { top: rect.bottom + 8, left: Math.max(8, rect.left) },
    )
  }, [align])

  useEffect(() => {
    if (!open) return
    place()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('keydown', onKey)
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open, place])

  const triggerEl = isValidElement(trigger)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ? cloneElement(trigger, {
        onClick: (e: MouseEvent) => { trigger.props.onClick?.(e); setOpen(o => !o) },
        'aria-haspopup': 'menu',
        'aria-expanded': open,
      } as any)
    : trigger

  return (
    <div ref={anchorRef} className="relative inline-flex">
      {triggerEl}
      {open && (
        <Portal>
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
            style={{ zIndex: Z.dropdown, position: 'fixed', ...pos }}
            className={cn(
              'min-w-[200px]',
              'bg-white border border-gray-200 rounded-card shadow-pop p-1.5',
              className,
            )}
          >
            {children}
          </div>
        </Portal>
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
      type="button"
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
