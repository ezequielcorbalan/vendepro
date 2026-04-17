'use client'

import { useState, useRef, useEffect } from 'react'
import { Search, Building2, Plus } from 'lucide-react'
import Link from 'next/link'
import { apiFetch } from '@/lib/api'

interface PropertyOption {
  id: string
  address: string
  neighborhood: string
  city: string
  property_type: string
  size_m2: number | null
}

interface PropertySelectorProps {
  value: PropertyOption | null
  onChange: (property: PropertyOption | null) => void
}

export function PropertySelector({ value, onChange }: PropertySelectorProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<PropertyOption[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const debounce = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => () => clearTimeout(debounce.current), [])

  async function search(q: string) {
    if (!q.trim()) { setResults([]); setOpen(false); return }
    setLoading(true)
    try {
      const res = await apiFetch('properties', `/properties?q=${encodeURIComponent(q)}`)
      const data = (await res.json()) as any
      setResults(Array.isArray(data) ? data.slice(0, 8) : [])
      setOpen(true)
    } catch { setResults([]) }
    setLoading(false)
  }

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    setQuery(val)
    clearTimeout(debounce.current)
    debounce.current = setTimeout(() => search(val), 300)
  }

  function select(p: PropertyOption) {
    onChange(p)
    setQuery(p.address)
    setOpen(false)
    setResults([])
  }

  function clear() {
    onChange(null)
    setQuery('')
    setResults([])
    setOpen(false)
  }

  return (
    <div className="relative">
      {value ? (
        <div className="flex items-center gap-3 bg-[#ff007c]/5 border border-[#ff007c]/30 rounded-lg px-3 py-2">
          <Building2 className="w-4 h-4 text-[#ff007c] flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-800 truncate">{value.address}</p>
            <p className="text-xs text-gray-500">{value.neighborhood} · {value.property_type}</p>
          </div>
          <button type="button" onClick={clear} className="text-gray-400 hover:text-gray-600 text-sm">✕</button>
        </div>
      ) : (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={handleInput}
            onFocus={() => { if (query) setOpen(true) }}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            placeholder="Buscar propiedad por dirección o barrio..."
            className="w-full border rounded-lg pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-[#ff007c]/50 focus:border-[#ff007c]"
          />
        </div>
      )}

      {open && !value && (
        <div className="absolute z-50 w-full mt-1 bg-white border rounded-xl shadow-lg overflow-hidden">
          {loading ? (
            <p className="text-sm text-gray-400 text-center py-3">Buscando...</p>
          ) : results.length === 0 ? (
            <div className="p-3 text-center">
              <p className="text-sm text-gray-400 mb-2">Sin resultados</p>
              <Link href="/propiedades/nueva" className="inline-flex items-center gap-1 text-sm text-[#ff007c] hover:underline">
                <Plus className="w-3 h-3" /> Crear nueva propiedad
              </Link>
            </div>
          ) : (
            <>
              {results.map(p => (
                <button key={p.id} type="button" onMouseDown={() => select(p)}
                  className="w-full text-left px-3 py-2.5 hover:bg-gray-50 border-b last:border-0">
                  <p className="text-sm font-medium text-gray-800">{p.address}</p>
                  <p className="text-xs text-gray-500">
                    {p.neighborhood} · {p.property_type}{p.size_m2 ? ` · ${p.size_m2} m²` : ''}
                  </p>
                </button>
              ))}
              <Link href="/propiedades/nueva"
                className="flex items-center gap-1 text-xs text-[#ff007c] hover:underline px-3 py-2 border-t">
                <Plus className="w-3 h-3" /> Crear nueva propiedad
              </Link>
            </>
          )}
        </div>
      )}
    </div>
  )
}
