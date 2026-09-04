'use client'
import { useState, useRef, useEffect } from 'react'
import { Search, User, Building2, Users, X } from 'lucide-react'
import Link from 'next/link'
import { apiFetch } from '@/lib/api'
import { LEAD_STAGES, SEARCH_ENTITY_TONES, type LeadStage } from '@/lib/crm-config'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Text } from '@/components/ui/Typography'

export default function GlobalSearch() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<any>(null)

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
      <Button
        variant="outline"
        fullWidth
        onClick={() => setOpen(true)}
        className="justify-start gap-2 text-gray-400 hover:text-gray-600 font-normal"
        icon={<Search className="w-4 h-4" />}
      >
        <span className="flex-1 text-left">Buscar…</span>
        <kbd className="hidden sm:inline text-[10px] bg-gray-100 px-1.5 py-0.5 rounded-control text-gray-400">⌘K</kbd>
      </Button>
    )
  }

  return (
    <Modal
      open
      onClose={close}
      align="top"
      padded={false}
      className="max-w-lg"
    >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
          <Search className="w-5 h-5 text-gray-400 shrink-0" />
          <input ref={inputRef} type="text" value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Buscar leads, contactos, propiedades..."
            className="flex-1 text-sm outline-none placeholder-gray-400" />
          {query && (
            <Button variant="ghost" size="icon" aria-label="Limpiar búsqueda" onClick={() => { setQuery(''); setResults(null) }}>
              <X className="w-4 h-4 text-gray-400" />
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={close} className="text-xs text-gray-400">Esc</Button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto">
          {loading && <Text size="sm" tone="muted" className="p-4 text-center">Buscando…</Text>}
          {noResults && <Text size="sm" tone="muted" className="p-6 text-center">Sin resultados para &ldquo;{query}&rdquo;</Text>}

          {hasResults && (
            <div className="py-2">
              {results.leads?.length > 0 && (
                <div>
                  <Text size="xs" tone="muted" weight="bold" className="px-4 py-1.5 text-[10px] uppercase tracking-wider">Leads</Text>
                  {results.leads.map((l: any) => (
                    <Link key={l.id} href={`/leads/${l.id}`} onClick={close}
                      className="flex items-center gap-3 px-4 py-2 hover:bg-gray-50 transition-colors">
                      <User className={`w-4 h-4 shrink-0 ${SEARCH_ENTITY_TONES.lead}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-ink truncate">{l.full_name}</p>
                        <p className="text-[10px] text-gray-400 truncate">{l.phone} · {l.operation} · {l.neighborhood}</p>
                      </div>
                      <StatusBadge
                        size="sm"
                        className="shrink-0"
                        label={LEAD_STAGES[l.stage as LeadStage]?.label || l.stage}
                        color={LEAD_STAGES[l.stage as LeadStage]?.color}
                      />
                    </Link>
                  ))}
                </div>
              )}

              {results.contacts?.length > 0 && (
                <div>
                  <Text size="xs" tone="muted" weight="bold" className="px-4 py-1.5 text-[10px] uppercase tracking-wider">Contactos</Text>
                  {results.contacts.map((c: any) => (
                    <Link key={c.id} href="/contactos" onClick={close}
                      className="flex items-center gap-3 px-4 py-2 hover:bg-gray-50 transition-colors">
                      <Users className={`w-4 h-4 shrink-0 ${SEARCH_ENTITY_TONES.contact}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-ink truncate">{c.full_name}</p>
                        <p className="text-[10px] text-gray-400">{c.phone} · {c.contact_type}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}

              {results.properties?.length > 0 && (
                <div>
                  <Text size="xs" tone="muted" weight="bold" className="px-4 py-1.5 text-[10px] uppercase tracking-wider">Propiedades</Text>
                  {results.properties.map((p: any) => (
                    <Link key={p.id} href={`/propiedades/${p.id}`} onClick={close}
                      className="flex items-center gap-3 px-4 py-2 hover:bg-gray-50 transition-colors">
                      <Building2 className={`w-4 h-4 shrink-0 ${SEARCH_ENTITY_TONES.property}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-ink truncate">{p.address}</p>
                        <p className="text-[10px] text-gray-400">{p.neighborhood} · {p.property_type} · {p.owner_name}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}

          {!loading && !results && query.length < 2 && (
            <Text size="xs" tone="muted" className="p-4 text-center">Escribí al menos 2 caracteres para buscar</Text>
          )}
        </div>
    </Modal>
  )
}
