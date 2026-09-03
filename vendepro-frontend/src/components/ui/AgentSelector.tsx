'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { Search, ChevronDown, Check, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Z } from '@/lib/z'
import { Avatar } from './Avatar'

/**
 * Selector de agente para mirar los números de una persona.
 *
 * Filtra en memoria y no contra la API: el equipo de una inmobiliaria son
 * decenas de personas, no miles, y ya vienen cargadas. Eso hace que el
 * filtrado sea instantáneo mientras se escribe, sin debounce ni spinner.
 */
export interface AgentOption {
  id: string
  full_name: string
  role?: string
  photo_url?: string | null
}

interface AgentSelectorProps {
  agents: AgentOption[]
  /** `null` = toda la inmobiliaria. */
  value: string | null
  onChange: (agentId: string | null) => void
  /** Texto de la opción que agrupa a todos. */
  allLabel?: string
  className?: string
}

export function AgentSelector({
  agents,
  value,
  onChange,
  allLabel = 'Toda la inmobiliaria',
  className,
}: AgentSelectorProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)

  const selected = agents.find(a => a.id === value) ?? null

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return agents
    return agents.filter(a => a.full_name.toLowerCase().includes(q))
  }, [agents, query])

  // Al abrir, el foco va al buscador: se elige tecleando el nombre, sin mouse.
  useEffect(() => {
    if (open) searchRef.current?.focus()
    else setQuery('')
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  const pick = (id: string | null) => {
    onChange(id)
    setOpen(false)
  }

  return (
    <div className={cn('relative inline-flex', className)}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="inline-flex items-center gap-2 bg-white border border-gray-300 text-gray-700 rounded-control px-3 py-2 text-sm font-medium hover:bg-gray-50 transition-colors max-w-[15rem]"
      >
        {selected
          ? <Avatar name={selected.full_name} src={selected.photo_url} size="sm" className="w-5 h-5 text-[10px]" />
          : <Users className="w-4 h-4 text-gray-500 shrink-0" />}
        <span className="truncate">{selected ? selected.full_name : allLabel}</span>
        <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="fixed inset-0 cursor-default"
            style={{ zIndex: Z.dropdown - 1 }}
          />
          <div
            role="listbox"
            style={{ zIndex: Z.dropdown }}
            className="absolute top-full right-0 mt-2 w-72 bg-white border border-gray-200 rounded-card shadow-pop overflow-hidden"
          >
            <div className="relative border-b border-gray-100">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <input
                ref={searchRef}
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Buscar agente…"
                className="w-full pl-9 pr-3 py-2.5 text-sm outline-none placeholder:text-gray-400"
              />
            </div>

            <div className="max-h-72 overflow-y-auto p-1.5">
              <button
                type="button"
                role="option"
                aria-selected={value === null}
                onClick={() => pick(null)}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-control text-sm text-left text-gray-700 hover:bg-gray-100 transition-colors"
              >
                <Users className="w-4 h-4 text-gray-400 shrink-0" />
                <span className="flex-1 truncate">{allLabel}</span>
                {value === null && <Check className="w-4 h-4 text-primary shrink-0" />}
              </button>

              {filtered.map(agent => (
                <button
                  key={agent.id}
                  type="button"
                  role="option"
                  aria-selected={value === agent.id}
                  onClick={() => pick(agent.id)}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-control text-sm text-left text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  <Avatar name={agent.full_name} src={agent.photo_url} size="sm" className="w-6 h-6 text-[10px] shrink-0" />
                  <span className="flex-1 truncate">{agent.full_name}</span>
                  {value === agent.id && <Check className="w-4 h-4 text-primary shrink-0" />}
                </button>
              ))}

              {filtered.length === 0 && (
                <p className="px-2.5 py-3 text-sm text-gray-400 text-center">Ningún agente coincide</p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
