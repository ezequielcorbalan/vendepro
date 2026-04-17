'use client'

import { useState, useEffect } from 'react'
import { Plus, Trash2, GripVertical, Loader2, Settings } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'

const BLOCK_TYPES = {
  service: 'Servicio',
  video: 'Video',
  stats: 'Estadística',
  text: 'Texto',
} as const

export default function TasacionConfigPage() {
  const { toast } = useToast()
  const [blocks, setBlocks] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)

  function loadBlocks() {
    apiFetch('admin', '/tasacion-blocks')
      .then(r => r.json() as Promise<any>)
      .then(d => { setBlocks(Array.isArray(d) ? d : (d.blocks || [])); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => { loadBlocks() }, [])

  async function handleCreate() {
    const res = await apiFetch('admin', '/tasacion-blocks', {
      method: 'POST',
      body: JSON.stringify({ block_type: 'service', title: 'Nuevo bloque', section: 'commercial' }),
    })
    const data = (await res.json()) as any
    if (data.id) {
      toast('Bloque creado')
      loadBlocks()
      setEditingId(data.id)
    } else {
      toast(data.error || 'Error', 'error')
    }
  }

  async function handleUpdate(id: string, updates: any) {
    const res = await apiFetch('admin', '/tasacion-blocks', {
      method: 'PUT',
      body: JSON.stringify({ id, ...updates }),
    })
    const data = (await res.json()) as any
    if (data.error) toast(data.error, 'error')
    else { toast('Guardado'); loadBlocks() }
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar este bloque?')) return
    await apiFetch('admin', `/tasacion-blocks?id=${id}`, { method: 'DELETE' })
    toast('Bloque eliminado', 'warning')
    loadBlocks()
  }

  async function toggleEnabled(block: any) {
    await handleUpdate(block.id, { enabled: block.enabled ? 0 : 1 })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-800">Bloques de tasación</h1>
          <p className="text-gray-500 text-sm mt-1">Configura los bloques que aparecen en las tasaciones públicas</p>
        </div>
        <button onClick={handleCreate} className="bg-[#ff007c] text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 flex items-center gap-2">
          <Plus className="w-4 h-4" /> Nuevo bloque
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
      ) : blocks.length === 0 ? (
        <div className="bg-white rounded-xl border p-8 text-center">
          <Settings className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">Sin bloques configurados</p>
          <button onClick={handleCreate} className="text-[#ff007c] text-sm mt-2 hover:underline">Crear primer bloque</button>
        </div>
      ) : (
        <div className="space-y-3">
          {blocks.map(block => (
            <div key={block.id} className={`bg-white border rounded-xl ${!block.enabled ? 'opacity-60' : ''}`}>
              <div className="p-4 flex items-center gap-3">
                <GripVertical className="w-4 h-4 text-gray-300 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-gray-800 truncate">{block.title}</p>
                    <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full shrink-0">
                      {BLOCK_TYPES[block.block_type as keyof typeof BLOCK_TYPES] || block.block_type}
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full shrink-0 ${block.section === 'commercial' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                      {block.section === 'commercial' ? 'Comercial' : 'Condiciones'}
                    </span>
                  </div>
                  {block.description && <p className="text-xs text-gray-400 truncate mt-0.5">{block.description}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => toggleEnabled(block)}
                    className={`text-xs px-2 py-1 rounded-full font-medium ${block.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {block.enabled ? 'Activo' : 'Inactivo'}
                  </button>
                  <button onClick={() => setEditingId(editingId === block.id ? null : block.id)}
                    className="text-xs text-[#ff007c] hover:underline">Editar</button>
                  <button onClick={() => handleDelete(block.id)} className="p-1 text-gray-300 hover:text-red-500">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {editingId === block.id && (
                <BlockEditor block={block} onSave={(updates) => { handleUpdate(block.id, updates); setEditingId(null) }} onCancel={() => setEditingId(null)} />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function BlockEditor({ block, onSave, onCancel }: { block: any; onSave: (data: any) => void; onCancel: () => void }) {
  const [data, setData] = useState({
    title: block.title || '',
    description: block.description || '',
    block_type: block.block_type || 'service',
    section: block.section || 'commercial',
    icon: block.icon || '',
    number_label: block.number_label || '',
    video_url: block.video_url || '',
  })

  return (
    <div className="border-t p-4 bg-gray-50 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Título</label>
          <input value={data.title} onChange={e => setData(d => ({ ...d, title: e.target.value }))}
            className="border rounded-lg px-3 py-2 text-sm w-full" />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Tipo</label>
          <select value={data.block_type} onChange={e => setData(d => ({ ...d, block_type: e.target.value }))}
            className="border rounded-lg px-3 py-2 text-sm w-full">
            <option value="service">Servicio</option>
            <option value="video">Video</option>
            <option value="stats">Estadística</option>
            <option value="text">Texto</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Sección</label>
          <select value={data.section} onChange={e => setData(d => ({ ...d, section: e.target.value }))}
            className="border rounded-lg px-3 py-2 text-sm w-full">
            <option value="commercial">Comercial</option>
            <option value="conditions">Condiciones</option>
          </select>
        </div>
        {data.block_type === 'stats' && (
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Número/Dato</label>
            <input value={data.number_label} onChange={e => setData(d => ({ ...d, number_label: e.target.value }))}
              placeholder="ej: +200 clientes" className="border rounded-lg px-3 py-2 text-sm w-full" />
          </div>
        )}
        {data.block_type === 'video' && (
          <div>
            <label className="text-xs text-gray-500 mb-1 block">URL de YouTube</label>
            <input value={data.video_url} onChange={e => setData(d => ({ ...d, video_url: e.target.value }))}
              placeholder="https://youtube.com/..." className="border rounded-lg px-3 py-2 text-sm w-full" />
          </div>
        )}
      </div>
      <div>
        <label className="text-xs text-gray-500 mb-1 block">Descripción</label>
        <textarea value={data.description} onChange={e => setData(d => ({ ...d, description: e.target.value }))}
          rows={2} className="border rounded-lg px-3 py-2 text-sm w-full" />
      </div>
      <div className="flex gap-2">
        <button onClick={onCancel} className="flex-1 border rounded-lg py-2 text-sm">Cancelar</button>
        <button onClick={() => onSave(data)} className="flex-1 bg-[#ff007c] text-white rounded-lg py-2 text-sm font-medium">
          Guardar
        </button>
      </div>
    </div>
  )
}
