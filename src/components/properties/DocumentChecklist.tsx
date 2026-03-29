'use client'
import { useState, useEffect } from 'react'
import { FileText, Plus, Check, Clock, AlertTriangle, Loader2, X } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'

type CheckItem = {
  id: string
  item_name: string
  checked: number
  checked_at: string | null
  sort_order: number
}

export default function DocumentChecklist({ propertyId }: { propertyId: string }) {
  const { toast } = useToast()
  const [items, setItems] = useState<CheckItem[]>([])
  const [loading, setLoading] = useState(true)
  const [initializing, setInitializing] = useState(false)
  const [newItem, setNewItem] = useState('')
  const [adding, setAdding] = useState(false)

  const loadItems = () => {
    fetch(`/api/property-checklist?property_id=${propertyId}`)
      .then(r => (r.json()) as Promise<any>)
      .then(d => { setItems(d.items || []); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => { loadItems() }, [propertyId])

  const initDefaults = async () => {
    setInitializing(true)
    try {
      const res = await fetch('/api/property-checklist', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ property_id: propertyId, action: 'create_defaults' }),
      })
      const d = (await res.json()) as any
      if (d.created) {
        toast(`${d.created} items de checklist creados`, 'success')
        loadItems()
      } else {
        toast(d.error || 'Error', 'error')
      }
    } catch { toast('Error', 'error') }
    finally { setInitializing(false) }
  }

  const toggleItem = async (itemId: string) => {
    // Optimistic toggle
    setItems(prev => prev.map(i => i.id === itemId ? { ...i, checked: i.checked ? 0 : 1 } : i))
    try {
      await fetch('/api/property-checklist', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: itemId, action: 'toggle' }),
      })
    } catch { loadItems() }
  }

  const addCustomItem = async () => {
    if (!newItem.trim()) return
    setAdding(true)
    try {
      const res = await fetch('/api/property-checklist', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ property_id: propertyId, item_name: newItem.trim() }),
      })
      const d = (await res.json()) as any
      if (d.id) {
        setNewItem('')
        loadItems()
        toast('Item agregado')
      }
    } catch { toast('Error', 'error') }
    finally { setAdding(false) }
  }

  const deleteItem = async (itemId: string) => {
    setItems(prev => prev.filter(i => i.id !== itemId))
    try {
      await fetch(`/api/property-checklist?id=${itemId}`, { method: 'DELETE' })
    } catch { loadItems() }
  }

  const checked = items.filter(i => i.checked).length
  const total = items.length
  const pct = total > 0 ? Math.round((checked / total) * 100) : 0

  if (loading) return <div className="animate-pulse h-40 bg-gray-100 rounded-xl" />

  return (
    <div className="bg-white rounded-xl shadow-sm p-4 sm:p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-gray-800 flex items-center gap-2">
          <FileText className="w-4 h-4 text-indigo-500" /> Documentación
        </h2>
        {items.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">{checked}/{total}</span>
            <div className="w-20 h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all ${pct >= 80 ? 'bg-green-500' : pct >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${pct}%` }} />
            </div>
            <span className="text-xs font-bold text-gray-600">{pct}%</span>
          </div>
        )}
      </div>

      {items.length === 0 ? (
        <div className="text-center py-6">
          <FileText className="w-10 h-10 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500 mb-3">Sin checklist de documentación</p>
          <button onClick={initDefaults} disabled={initializing}
            className="bg-[#ff007c] text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-1.5">
            {initializing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Cargar checklist por defecto
          </button>
        </div>
      ) : (
        <>
          {pct < 100 && checked > 0 && (
            <div className="mb-3 p-2 bg-yellow-50 border border-yellow-200 rounded-lg flex items-center gap-2 text-xs text-yellow-700">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              {total - checked} documento{total - checked > 1 ? 's' : ''} pendiente{total - checked > 1 ? 's' : ''}
            </div>
          )}
          <div className="space-y-0.5 max-h-[400px] overflow-y-auto">
            {items.map(item => (
              <div key={item.id} className={`flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-gray-50 group ${item.checked ? 'opacity-60' : ''}`}>
                <button onClick={() => toggleItem(item.id)}
                  className={`w-5 h-5 rounded flex items-center justify-center border-2 transition-all shrink-0 ${
                    item.checked ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300 hover:border-green-400'
                  }`}>
                  {item.checked ? <Check className="w-3 h-3" /> : null}
                </button>
                <span className={`text-sm flex-1 ${item.checked ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                  {item.item_name}
                </span>
                {item.checked_at && (
                  <span className="text-[9px] text-gray-300 hidden sm:inline">
                    {new Date(item.checked_at).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })}
                  </span>
                )}
                <button onClick={() => deleteItem(item.id)}
                  className="p-1 text-gray-200 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all shrink-0">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>

          {/* Add custom item */}
          <div className="mt-3 pt-3 border-t border-gray-100 flex gap-2">
            <input
              type="text"
              value={newItem}
              onChange={e => setNewItem(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addCustomItem()}
              placeholder="Agregar item..."
              className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:ring-1 focus:ring-[#ff007c] focus:border-[#ff007c] outline-none"
            />
            <button onClick={addCustomItem} disabled={adding || !newItem.trim()}
              className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-sm hover:bg-gray-200 disabled:opacity-50">
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </>
      )}
    </div>
  )
}
