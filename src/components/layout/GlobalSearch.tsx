'use client'
import { useState, useRef, useEffect } from 'react'
import { Search, User, Building2, Users, X } from 'lucide-react'
import Link from 'next/link'
import { LEAD_STAGES, type LeadStage } from '@/lib/crm-config'

export default function GlobalSearch() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<any>(null)

  useEffect(() => {
    if (!query || query.length < 2) { setResults(null); return }
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`)
        const data = (await res.json()) as any
        setResults(data)
      } catch { setResults(null) }
      setLoading(false)
    }, 300)
  }, [query])

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus()
  }, [open])

  // Close on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Keyboard shortcut: Ctrl+K
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(true)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [])

  const hasResults = results && (results.leads?.length > 0 || results.contacts?.length > 0 || results.properties?.length > 0)
  const noResults = results && !hasResults && query.length >= 2

  function close() { setOpen(false); setQuery(''); setResults(null) }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="flex items-center gap-2 text-gray-400 hover:text-gray-600 transition-colors w-full px-3 py-2 rounded-lg border border-gray-200 hover:border-gray-300 bg-white text-sm">
        <Search className="w-4 h-4" />
        <span className="flex-1 text-left">Buscar...</span>
        <kbd className="hidden sm:inline text-[10px] bg-gray-100 px-1.5 py-0.5 rounded text-gray-400">⌘K</kbd>
      </button>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-start justify-center pt-[10vh]" onClick={close}>
      <div ref={containerRef} className="bg-white rounded-xl shadow-2xl w-[90vw] max-w-lg mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b">
          <Search className="w-5 h-5 text-gray-400 shrink-0" />
          <input ref={inputRef} type="text" value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Buscar leads, contactos, propiedades..."
            className="flex-1 text-sm outline-none placeholder-gray-400" />
          {query && <button onClick={() => { setQuery(''); setResults(null) }}><X className="w-4 h-4 text-gray-400" /></button>}
          <button onClick={close} className="text-xs text-gray-400 hover:text-gray-600">Esc</button>
        </div>

        {/* Results */}
        <div className="max-h-[60vh] overflow-y-auto">
          {loading && <div className="p-4 text-center text-sm text-gray-400">Buscando...</div>}

          {noResults && <div className="p-6 text-center text-sm text-gray-400">Sin resultados para &quot;{query}&quot;</div>}

          {hasResults && (
            <div className="py-2">
              {results.leads?.length > 0 && (
                <div>
                  <p className="px-4 py-1.5 text-[10px] text-gray-400 uppercase tracking-wider font-bold">Leads</p>
                  {results.leads.map((l: any) => (
                    <Link key={l.id} href={`/leads/${l.id}`} onClick={close}
                      className="flex items-center gap-3 px-4 py-2 hover:bg-gray-50 transition-colors">
                      <User className="w-4 h-4 text-pink-500 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-800 truncate">{l.full_name}</p>
                        <p className="text-[10px] text-gray-400 truncate">{l.phone} · {l.operation} · {l.neighborhood}</p>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full shrink-0 ${LEAD_STAGES[l.stage as LeadStage]?.color || 'bg-gray-100 text-gray-600'}`}>
                        {LEAD_STAGES[l.stage as LeadStage]?.label || l.stage}
                      </span>
                    </Link>
                  ))}
                </div>
              )}

              {results.contacts?.length > 0 && (
                <div>
                  <p className="px-4 py-1.5 text-[10px] text-gray-400 uppercase tracking-wider font-bold">Contactos</p>
                  {results.contacts.map((c: any) => (
                    <Link key={c.id} href={`/contactos`} onClick={close}
                      className="flex items-center gap-3 px-4 py-2 hover:bg-gray-50 transition-colors">
                      <Users className="w-4 h-4 text-blue-500 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-800 truncate">{c.full_name}</p>
                        <p className="text-[10px] text-gray-400">{c.phone} · {c.contact_type}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}

              {results.properties?.length > 0 && (
                <div>
                  <p className="px-4 py-1.5 text-[10px] text-gray-400 uppercase tracking-wider font-bold">Propiedades</p>
                  {results.properties.map((p: any) => (
                    <Link key={p.id} href={`/propiedades/${p.id}`} onClick={close}
                      className="flex items-center gap-3 px-4 py-2 hover:bg-gray-50 transition-colors">
                      <Building2 className="w-4 h-4 text-green-500 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-800 truncate">{p.address}</p>
                        <p className="text-[10px] text-gray-400">{p.neighborhood} · {p.property_type} · {p.owner_name}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}

          {!loading && !results && query.length < 2 && (
            <div className="p-4 text-center text-xs text-gray-400">Escribí al menos 2 caracteres para buscar</div>
          )}
        </div>
      </div>
    </div>
  )
}
