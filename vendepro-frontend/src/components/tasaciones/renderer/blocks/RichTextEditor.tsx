'use client'
import { useEffect, useRef, useState } from 'react'
import { Bold, Italic, List, ListOrdered, Link2 } from 'lucide-react'
import { sanitizeRichText } from '../sanitize-html'

interface Props {
  html: string
  onCommit: (html: string) => void
}

// Editor rich-text mínimo basado en contentEditable + execCommand. Guarda HTML
// saneado en blur. execCommand está deprecado pero sigue soportado en todos los
// navegadores y evita sumar una dependencia de editor.
export function RichTextEditor({ html, onCommit }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [focused, setFocused] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el || el === document.activeElement) return
    if (el.innerHTML !== html) el.innerHTML = html
  }, [html])

  const exec = (command: string, value?: string) => {
    ref.current?.focus()
    document.execCommand(command, false, value)
  }

  const addLink = () => {
    const url = window.prompt('URL del enlace (https://…)')
    if (url) exec('createLink', url)
  }

  const commit = () => {
    const el = ref.current
    if (!el) return
    const next = sanitizeRichText(el.innerHTML)
    if (next !== html) onCommit(next)
  }

  return (
    <div className="rounded-lg border border-slate-200">
      <div className={`flex items-center gap-0.5 border-b border-slate-200 px-1.5 py-1 transition-opacity ${focused ? 'opacity-100' : 'opacity-60'}`}>
        <ToolbarButton title="Negrita" onClick={() => exec('bold')}><Bold className="h-3.5 w-3.5" /></ToolbarButton>
        <ToolbarButton title="Cursiva" onClick={() => exec('italic')}><Italic className="h-3.5 w-3.5" /></ToolbarButton>
        <span className="mx-1 h-4 w-px bg-slate-200" />
        <ToolbarButton title="Lista" onClick={() => exec('insertUnorderedList')}><List className="h-3.5 w-3.5" /></ToolbarButton>
        <ToolbarButton title="Lista numerada" onClick={() => exec('insertOrderedList')}><ListOrdered className="h-3.5 w-3.5" /></ToolbarButton>
        <span className="mx-1 h-4 w-px bg-slate-200" />
        <ToolbarButton title="Enlace" onClick={addLink}><Link2 className="h-3.5 w-3.5" /></ToolbarButton>
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-label="Párrafo de texto con formato"
        aria-multiline={true}
        tabIndex={0}
        data-placeholder="Escribí un párrafo… (podés usar negrita, cursiva, listas y links)"
        className="te-editable te-richtext min-h-[4rem] px-3 py-2 text-base leading-relaxed text-slate-700 outline-none"
        // Nota: onMouseDown en la toolbar previene perder el foco; el commit va en blur del área.
        onFocus={() => setFocused(true)}
        onBlur={() => { setFocused(false); commit() }}
      />
    </div>
  )
}

function ToolbarButton({ title, onClick, children }: { title: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={title}
      // preventDefault en mousedown para no robar el foco al área editable.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
    >
      {children}
    </button>
  )
}
