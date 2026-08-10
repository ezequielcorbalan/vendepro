import type { InputHTMLAttributes, TextareaHTMLAttributes, SelectHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * Controles de formulario del design system.
 * Base unificada: full-width, borde gray-300, rounded-control y foco gris accesible
 * (el anillo de foco por teclado lo aporta globals.css :focus-visible).
 * El chevron del <select> también viene de globals.css.
 */
const FIELD_BASE =
  'w-full border border-gray-300 rounded-control px-4 py-2.5 text-sm text-ink bg-white ' +
  'placeholder:text-gray-400 focus:outline-none disabled:bg-gray-100 disabled:cursor-not-allowed'

const ERROR_RING = 'border-danger'

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(FIELD_BASE, className)} {...props} />
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(FIELD_BASE, 'resize-y min-h-[88px]', className)} {...props} />
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(FIELD_BASE, 'cursor-pointer', className)} {...props}>
      {children}
    </select>
  )
}

/**
 * Envuelve un control con su label, hint y/o error. Genera el htmlFor si le pasás
 * htmlFor, o usá <Field label="..."><Input .../></Field> directamente.
 */
interface FieldProps {
  label?: string
  hint?: string
  error?: string
  htmlFor?: string
  required?: boolean
  className?: string
  children: ReactNode
}

export function Field({ label, hint, error, htmlFor, required, className, children }: FieldProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && (
        <label htmlFor={htmlFor} className="text-sm font-medium text-gray-700">
          {label}
          {required && <span className="text-primary ml-0.5">*</span>}
        </label>
      )}
      {children}
      {error ? (
        <p className="text-xs text-danger">{error}</p>
      ) : hint ? (
        <p className="text-xs text-gray-500">{hint}</p>
      ) : null}
    </div>
  )
}

export { ERROR_RING as INPUT_ERROR_CLASS }
