'use client'

import { useId, type ReactNode, type InputHTMLAttributes, type TextareaHTMLAttributes, type SelectHTMLAttributes } from 'react'
import { Input, Textarea, Select } from '@/components/ui/Input'
import { cn } from '@/lib/utils'

/**
 * Molde de un campo del editor de tasación. Lo usan los 17 formularios de
 * bloque y el panel de datos de `EditorShell`, que tenía su propio
 * `AppraisalField` con la misma cadena de clases.
 *
 * Los 17 formularios repetían la misma estructura a mano —`<label>` + `<span>`
 * con la etiqueta en minúsculas altas + un `<input>` nativo con la misma cadena
 * de clases— 42 veces sólo contando los inputs. El control ahora es el del DS
 * (foco, error, disabled y placeholder salen de ahí); acá vive únicamente la
 * decisión de DENSIDAD, que es lo propio de este contexto: estos formularios
 * viven en el panel angosto del editor, con cinco o seis campos a la vez, y el
 * padding estándar del DS (py-2.5) los hace ilegiblemente largos.
 */
// ds-todo: candidato a variante `size="sm"` de Input/Textarea/Select. Hoy el
// único contexto que la necesita es este panel; si un segundo lo pide, se
// promueve al DS en vez de vivir acá.
const COMPACT = 'px-2 py-1.5 text-sm'

export function BlockField({
  label,
  hint,
  className,
  children,
}: {
  label: string
  hint?: string
  className?: string
  children: ReactNode
}) {
  return (
    <label className={cn('flex flex-col gap-1', className)}>
      <span className="text-xs uppercase tracking-wide text-gray-600">{label}</span>
      {children}
      {hint && <span className="text-[11px] text-gray-400">{hint}</span>}
    </label>
  )
}

export function BlockInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <Input className={cn(COMPACT, className)} {...props} />
}

export function BlockTextarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <Textarea className={cn(COMPACT, 'min-h-0', className)} {...props} />
}

export function BlockSelect({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <Select className={cn(COMPACT, className)} {...props}>{children}</Select>
}
