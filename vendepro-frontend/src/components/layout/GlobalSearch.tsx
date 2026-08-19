'use client'
import { useState, useRef, useEffect } from 'react'
import { Search, User, Building2, Users, X } from 'lucide-react'
import Link from 'next/link'
import { apiFetch } from '@/lib/api'
import { Z } from '@/lib/z'
import { StageBadge } from '@/components/ui/StageBadge'
import { Text } from '@/components/ui/Typography'
import { useOverlay } from '@/components/ui/useOverlay'

export default function GlobalSearch() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<any>(null)

  function close() { setOpen(false); setQuery(''); setResults(null) }

  // Esc + scroll-lock + focus-trap del DS (mismo comportamiento que Modal/Drawer).
  useOverlay(open, close, panelRef)

  useEffect(() => {
    if (!query || query.length < 2) { setResults(null); return }
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await apiFetch('analytics', `/search?q=${encodeURIComponent(query)}`)
        const data = (await res.json()) as any
        setResults(data)
      } catch { setResults(null) }
      setLoading(false)
    }, 300)
  }, [query])

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus()
  }, [open])

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(true)
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [])

  const hasResults = results && (results.leads?.length > 0 || results.contacts?.length > 0 || results.properties?.length > 0)
  const noResults = results && !hasResults && query.length >= 2

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)}
        className="flex items-center gap-2 text-gray-400 hover:text-gray-600 transition-colors w-full px-3 py-2 rounded-control border border-gray-200 hover:border-gray-300 bg-white text-sm">
        <Search className="w-4 h-4" aria-hidden="true" />
        <span className="flex-1 text-left">Buscar...</span>
        <kbd className="hidden sm:inline text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-400">⌘K</kbd>
      </button>
    )
  }

  return (
    <div
      className="fixed inset-0 bg-black/30 flex items-start justify-center pt-[10vh]"
      style={{ zIndex: Z.modal }}
      onClick={close}
    >
      {/* Command palette: el input va sin marco (excepción documentada en la
          regla 9 de ds-visual-rules.md) porque el marco es el panel. */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Búsqueda global"
        tabIndex={-1}
        className="bg-white rounded-card shadow-pop w-[90vw] max-w-lg mx-4 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200">
          <Search className="w-5 h-5 text-gray-400 shrink-0" aria-hidden="true" />
          <input ref={inputRef} type="text" value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Buscar leads, contactos, propiedades..."
            aria-label="Buscar leads, contactos o propiedades"
            className="flex-1 text-sm outline-none placeholder-gray-400" />
          {query && (
            <button type="button" onClick={() => { setQuery(''); setResults(null) }} aria-label="Limpiar búsqueda">
              <X className="w-4 h-4 text-gray-400" aria-hidden="true" />
            </button>
          )}
          <button type="button" onClick={close} className="text-xs text-gray-400 hover:text-gray-600">Esc</button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto">
          {loading && <div className="p-4 text-center"><Text size="sm" tone="muted">Buscando...</Text></div>}
          {noResults && <div className="p-6 text-center"><Text size="sm" tone="muted">Sin resultados para &quot;{query}&quot;</Text></div>}

          {hasResults && (
            <div className="py-2">
              {results.leads?.length > 0 && (
                <div>
                  <Text size="xs" weight="semibold" tone="muted" className="px-4 py-1.5 uppercase tracking-wider">Leads</Text>
                  {results.leads.map((l: any) => (
                    <Link key={l.id} href={`/leads/${l.id}`} onClick={close}
                      className="flex items-center gap-3 px-4 py-2 hover:bg-gray-50 transition-colors">
                      <User className="w-4 h-4 text-primary shrink-0" aria-hidden="true" />
                      <div className="flex-1 min-w-0">
                        <Text size="sm" className="truncate">{l.full_name}</Text>
                        <Text size="xs" tone="muted" className="truncate">{l.phone} · {l.operation} · {l.neighborhood}</Text>
                      </div>
                      <StageBadge stage={l.stage} size="sm" className="shrink-0" />
                    </Link>
                  ))}
                </div>
              )}

              {results.contacts?.length > 0 && (
                <div>
                  <Text size="xs" weight="semibold" tone="muted" className="px-4 py-1.5 uppercase tracking-wider">Contactos</Text>
                  {results.contacts.map((c: any) => (
                    <Link key={c.id} href="/contactos" onClick={close}
                      className="flex items-center gap-3 px-4 py-2 hover:bg-gray-50 transition-colors">
                      <Users className="w-4 h-4 text-info shrink-0" aria-hidden="true" />
                      <div className="flex-1 min-w-0">
                        <Text size="sm" className="truncate">{c.full_name}</Text>
                        <Text size="xs" tone="muted">{c.phone} · {c.contact_type}</Text>
                      </div>
                    </Link>
                  ))}
                </div>
              )}

              {results.properties?.length > 0 && (
                <div>
                  <Text size="xs" weight="semibold" tone="muted" className="px-4 py-1.5 uppercase tracking-wider">Propiedades</Text>
                  {results.properties.map((p: any) => (
                    <Link key={p.id} href={`/propiedades/${p.id}`} onClick={close}
                      className="flex items-center gap-3 px-4 py-2 hover:bg-gray-50 transition-colors">
                      <Building2 className="w-4 h-4 text-success shrink-0" aria-hidden="true" />
                      <div className="flex-1 min-w-0">
                        <Text size="sm" className="truncate">{p.address}</Text>
                        <Text size="xs" tone="muted">{p.neighborhood} · {p.property_type} · {p.owner_name}</Text>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}

          {!loading && !results && query.length < 2 && (
            <div className="p-4 text-center"><Text size="xs" tone="muted">Escribí al menos 2 caracteres para buscar</Text></div>
          )}
        </div>
      </div>
    </div>
  )
}
