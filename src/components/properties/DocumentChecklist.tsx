'use client'
import { useState, useEffect } from 'react'
import { FileText, Plus, Check, AlertTriangle, Loader2, X, Clock, CheckCircle } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'

type CheckItem = {
  id: string
  item_name: string
  checked: number
  checked_at: string | null
  sort_order: number
}

export default function DocumentChecklist({ propertyId, createdAt }: { propertyId: string; createdAt?: string }) {
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
      if (d.id) { setNewItem(''); loadItems(); toast('Item agregado') }
    } catch { toast('Error', 'error') }
    finally { setAdding(false) }
  }

  const deleteItem = async (itemId: string) => {
    setItems(prev => prev.filter(i => i.id !== itemId))
    try { await fetch(`/api/property-checklist?id=${itemId}`, { method: 'DELETE' }) } catch { loadItems() }
  }

  const checked = items.filter(i => i.checked).length
  const total = items.length
  const pct = total > 0 ? Math.round((checked / total) * 100) : 0
  const allComplete = pct === 100 && total > 0

  // Calculate days since creation for 15-day alert
  const daysSinceCreation = createdAt
    ? Math.floor((Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24))
    : null
  const deadlineDays = 15
  const daysRemaining = daysSinceCreation !== null ? deadlineDays - daysSinceCreation : null
  const isOverdue = daysRemaining !== null && daysRemaining < 0
  const isUrgent = daysRemaining !== null && daysRemaining >= 0 && daysRemaining <= 5

  if (loading) return <div className="animate-pulse h-40 bg-gray-100 rounded-xl" />

  return (
    <div className="bg-white rounded-xl shadow-sm p-5 sm:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${allComplete ? 'bg-green-100' : 'bg-indigo-50'}`}>
            {allComplete ? <CheckCircle className="w-5 h-5 text-green-600" /> : <FileText className="w-5 h-5 text-indigo-500" />}
          </div>
          <div>
            <h2 className="font-bold text-gray-800 text-base">Documentación</h2>
            {total > 0 && (
              <p className="text-xs text-gray-400">{checked} de {total} completos</p>
            )}
          </div>
        </div>
        {items.length > 0 && (
          <div className="flex items-center gap-3">
            <div className="w-24 h-3 bg-gray-100 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all ${allComplete ? 'bg-green-500' : pct >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${pct}%` }} />
            </div>
            <span className={`text-sm font-black ${allComplete ? 'text-green-600' : 'text-gray-700'}`}>{pct}%</span>
          </div>
        )}
      </div>

      {/* 15-day deadline alert */}
      {total > 0 && !allComplete && daysRemaining !== null && (
        <div className={`mb-4 p-3 rounded-xl flex items-center gap-2.5 text-sm ${
          isOverdue ? 'bg-red-50 border border-red-200 text-red-700' :
          isUrgent ? 'bg-orange-50 border border-orange-200 text-orange-700' :
          'bg-blue-50 border border-blue-200 text-blue-700'
        }`}>
          {isOverdue ? <AlertTriangle className="w-4 h-4 shrink-0" /> : <Clock className="w-4 h-4 shrink-0" />}
          <div>
            <span className="font-semibold">
              {isOverdue
                ? `Documentación vencida (${Math.abs(daysRemaining)} días de atraso)`
                : `${daysRemaining} días para completar la documentación`
              }
            </span>
            <span className="text-xs ml-1 opacity-70">
              · Meta: {deadlineDays} días desde captación
            </span>
          </div>
        </div>
      )}

      {allComplete && (
        <div className="mb-4 p-3 rounded-xl bg-green-50 border border-green-200 text-green-700 text-sm flex items-center gap-2">
          <CheckCircle className="w-4 h-4" />
          <span className="font-semibold">Documentación completa</span>
        </div>
      )}

      {items.length === 0 ? (
        <div className="text-center py-8">
          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500 mb-4">Sin checklist de documentación</p>
          <button onClick={initDefaults} disabled={initializing}
            className="bg-[#ff007c] text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-2">
            {initializing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Cargar checklist por defecto
          </button>
        </div>
      ) : (
        <>
          {/* Grid layout for items */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {items.map(item => (
              <div key={item.id} className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg hover:bg-gray-50 group transition-colors ${item.checked ? 'bg-green-50/50' : 'bg-gray-50/50'}`}>
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
          <div className="mt-4 pt-4 border-t border-gray-100 flex gap-2">
            <input
              type="text"
              value={newItem}
              onChange={e => setNewItem(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addCustomItem()}
              placeholder="Agregar item..."
              className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:ring-1 focus:ring-[#ff007c] focus:border-[#ff007c] outline-none"
            />
            <button onClick={addCustomItem} disabled={adding || !newItem.trim()}
              className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm hover:bg-gray-200 disabled:opacity-50 flex items-center gap-1">
              <Plus className="w-4 h-4" /> Agregar
            </button>
          </div>
        </>
      )}
    </div>
  )
}
