'use client'
import { useEffect, useRef } from 'react'

type Tag = 'div' | 'p' | 'span' | 'h1' | 'h2' | 'h3'

interface Props {
  value: string
  onCommit: (next: string) => void
  as?: Tag
  className?: string
  placeholder?: string
  /** true = texto plano (usa textContent); false = HTML (usa innerHTML). */
  plaintext?: boolean
}

/**
 * contentEditable no controlado: el contenido se inicializa por ref una sola vez
 * y solo se re-sincroniza desde props cuando el nodo NO tiene el foco (así no se
 * reposiciona el cursor mientras el usuario escribe). Commit en blur.
 */
export function InlineEditable({ value, onCommit, as = 'div', className, placeholder, plaintext = false }: Props) {
  const ref = useRef<HTMLElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el || el === document.activeElement) return
    const current = plaintext ? (el.textContent ?? '') : el.innerHTML
    if (current !== value) {
      if (plaintext) el.textContent = value
      else el.innerHTML = value
    }
  }, [value, plaintext])

  const Tag = as as any
  return (
    <Tag
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      aria-label={placeholder}
      aria-multiline={false}
      tabIndex={0}
      data-placeholder={placeholder}
      spellCheck={false}
      className={`te-editable outline-none focus:ring-2 focus:ring-brand-pink/40 rounded ${className ?? ''}`}
      onBlur={(e: React.FocusEvent<HTMLElement>) => {
        const next = plaintext ? (e.currentTarget.textContent ?? '') : (e.currentTarget.innerHTML ?? '')
        if (next !== value) onCommit(next)
      }}
    />
  )
}
