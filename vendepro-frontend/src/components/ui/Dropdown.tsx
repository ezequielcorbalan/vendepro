'use client'

import { useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * Dropdown / menú contextual del design system. Maneja su propio estado abierto
 * y cierra al clickear afuera (backdrop invisible). Componé con DropdownItem /
 * DropdownSeparator.
 */
interface DropdownProps {
  /** El disparador (ej. un Button o un ícono). */
  trigger: ReactNode
  children: ReactNode
  align?: 'left' | 'right'
  className?: string
}

export function Dropdown({ trigger, children, align = 'left', className }: DropdownProps) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative inline-flex">
      <span onClick={() => setOpen(o => !o)}>{trigger}</span>
      {open && (
        <>
          <button
            className="fixed inset-0 z-40 cursor-default"
            aria-hidden
            tabIndex={-1}
            onClick={() => setOpen(false)}
          />
          <div
            role="menu"
            onClick={() => setOpen(false)}
            className={cn(
              'absolute top-full mt-2 z-50 min-w-[200px]',
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
