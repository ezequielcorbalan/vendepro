'use client'

import {
  createContext, useContext, useId, forwardRef,
  type InputHTMLAttributes, type TextareaHTMLAttributes, type SelectHTMLAttributes, type ReactNode,
} from 'react'
import { cn } from '@/lib/utils'

/**
 * Controles de formulario del design system.
 * `Field` genera el id (useId) y propaga el estado de error a su control vía
 * contexto: `<Field label="Email" error="...">​<Input /></Field>` asocia el
 * label y pinta el borde de error, sin cablear nada a mano.
 * Foco: `focus:border-primary` en cualquier foco; el anillo de teclado lo aporta
 * globals.css (:focus-visible).
 */
const FIELD_BASE =
  'w-full border border-gray-300 rounded-control px-4 py-2.5 text-sm text-ink bg-white ' +
  'placeholder:text-gray-400 focus:border-primary disabled:bg-gray-100 disabled:cursor-not-allowed'

const ERROR_CLASS = 'border-danger'

interface FieldCtx {
  id?: string
  hasError?: boolean
}
const FieldContext = createContext<FieldCtx>({})

/**
 * `forwardRef` porque un control de formulario tiene que poder enfocarse por
 * código (autofocus de un panel, saltar al primer campo con error). Sin esto el
 * llamador se veía forzado a usar un `<input>` nativo y perdía el estilo, el
 * foco y el estado de error del DS.
 */
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ id, className, ...props }, ref) {
    const ctx = useContext(FieldContext)
    return <input ref={ref} id={id ?? ctx.id} className={cn(FIELD_BASE, ctx.hasError && ERROR_CLASS, className)} {...props} />
  },
)

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ id, className, ...props }, ref) {
    const ctx = useContext(FieldContext)
    return (
      <textarea
        ref={ref}
        id={id ?? ctx.id}
        className={cn(FIELD_BASE, 'resize-y min-h-[88px]', ctx.hasError && ERROR_CLASS, className)}
        {...props}
      />
    )
  },
)

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ id, className, children, ...props }, ref) {
    const ctx = useContext(FieldContext)
    return (
      <select ref={ref} id={id ?? ctx.id} className={cn(FIELD_BASE, 'cursor-pointer', ctx.hasError && ERROR_CLASS, className)} {...props}>
        {children}
      </select>
    )
  },
)

interface FieldProps {
  label?: string
  hint?: string
  error?: string
  /** Forzar un id; si no, Field genera uno con useId. */
  htmlFor?: string
  required?: boolean
  className?: string
  children: ReactNode
}

export function Field({ label, hint, error, htmlFor, required, className, children }: FieldProps) {
  const genId = useId()
  const id = htmlFor ?? genId
  return (
    <FieldContext.Provider value={{ id, hasError: !!error }}>
      <div className={cn('flex flex-col gap-1.5', className)}>
        {label && (
          <label htmlFor={id} className="text-sm font-medium text-gray-700">
            {label}
            {required && <span className="text-danger ml-0.5">*</span>}
          </label>
        )}
        {children}
        {error ? (
          <p className="text-xs text-danger">{error}</p>
        ) : hint ? (
          <p className="text-xs text-gray-500">{hint}</p>
        ) : null}
      </div>
    </FieldContext.Provider>
  )
}

export { ERROR_CLASS as INPUT_ERROR_CLASS }
