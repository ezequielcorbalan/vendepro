'use client'

import { useState, useEffect } from 'react'
import { Plus, ChevronUp, ChevronDown, Pencil, Trash2, Eye, EyeOff, Monitor } from 'lucide-react'
import { ICON_MAP } from './IconPicker'
import BlockEditModal from './BlockEditModal'
import BlocksPreview from './BlocksPreview'

const BLOCK_TYPE_LABELS: Record<string, string> = {
  service: 'Servicio',
  video: 'Video',
  stats: 'Datos',
  text: 'Texto',
  custom: 'Custom',
}

export default function TasacionBlocksEditor() {
  const [blocks, setBlocks] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [editBlock, setEditBlock] = useState<any | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [reordering, setReordering] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [branding, setBranding] = useState<any>(null)
  const [settings, setSettings] = useState<Record<string, string>>({})

  useEffect(() => {
    loadBlocks()
    fetch('/api/org-branding').then(r => r.json()).then(d => setBranding(d))
    fetch('/api/org-settings').then(r => r.json()).then(d => setSettings(d as Record<string, string>))
  }, [])

  async function loadBlocks() {
    const res = await fetch('/api/tasacion-blocks')
    const data = (await res.json()) as any[]
    setBlocks(data)
    setLoading(false)
  }

  async function toggleBlock(id: string, enabled: number) {
    await fetch(`/api/tasacion-blocks/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: enabled ? 0 : 1 }),
    })
    setBlocks(bs => bs.map(b => b.id === id ? { ...b, enabled: enabled ? 0 : 1 } : b))
  }

  async function deleteBlock(id: string) {
    if (!confirm('¿Eliminar este bloque?')) return
    await fetch(`/api/tasacion-blocks/${id}`, { method: 'DELETE' })
    setBlocks(bs => bs.filter(b => b.id !== id))
  }

  async function moveBlock(id: string, direction: 'up' | 'down') {
    const idx = blocks.findIndex(b => b.id === id)
    if (direction === 'up' && idx === 0) return
    if (direction === 'down' && idx === blocks.length - 1) return

    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    const newBlocks = [...blocks]
    ;[newBlocks[idx], newBlocks[swapIdx]] = [newBlocks[swapIdx], newBlocks[idx]]

    // Update sort_order
    const updates = newBlocks.map((b, i) => ({ id: b.id, sort_order: i + 1 }))
    setBlocks(newBlocks.map((b, i) => ({ ...b, sort_order: i + 1 })))
    setReordering(true)

    await fetch('/api/tasacion-blocks/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ blocks: updates }),
    })
    setReordering(false)
  }

  async function handleSaveBlock(data: any) {
    if (editBlock?.id) {
      // Update existing
      await fetch(`/api/tasacion-blocks/${editBlock.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
    } else {
      // Create new
      await fetch('/api/tasacion-blocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
    }
    setShowModal(false)
    setEditBlock(null)
    await loadBlocks()
  }

  if (loading) return <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}</div>

  return (
    <div className="space-y-3">
      {blocks.map((block, idx) => {
        const Icon = ICON_MAP[block.icon] || null
        return (
          <div
            key={block.id}
            className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
              block.enabled ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-100 opacity-60'
            }`}
          >
            {/* Reorder */}
            <div className="flex flex-col gap-0.5">
              <button
                onClick={() => moveBlock(block.id, 'up')}
                disabled={idx === 0 || reordering}
                className="p-0.5 hover:bg-gray-100 rounded disabled:opacity-20"
              >
                <ChevronUp className="w-4 h-4 text-gray-400" />
              </button>
              <button
                onClick={() => moveBlock(block.id, 'down')}
                disabled={idx === blocks.length - 1 || reordering}
                className="p-0.5 hover:bg-gray-100 rounded disabled:opacity-20"
              >
                <ChevronDown className="w-4 h-4 text-gray-400" />
              </button>
            </div>

            {/* Number badge */}
            {block.number_label && (
              <span className="text-xs font-bold text-white bg-gradient-to-r from-pink-500 to-orange-400 w-7 h-7 flex items-center justify-center rounded-lg flex-shrink-0">
                {block.number_label}
              </span>
            )}

            {/* Icon */}
            {Icon && !block.number_label && (
              <div className="w-7 h-7 flex items-center justify-center flex-shrink-0">
                <Icon className="w-4 h-4 text-gray-500" />
              </div>
            )}

            {/* Title + type */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-800 truncate">{block.title}</p>
              <p className="text-[10px] text-gray-400 uppercase">
                {BLOCK_TYPE_LABELS[block.block_type] || block.block_type}
                {block.section === 'conditions' && ' · Condiciones'}
              </p>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={() => toggleBlock(block.id, block.enabled)}
                className="p-1.5 hover:bg-gray-100 rounded-lg"
                title={block.enabled ? 'Ocultar' : 'Mostrar'}
              >
                {block.enabled ? <Eye className="w-4 h-4 text-green-500" /> : <EyeOff className="w-4 h-4 text-gray-400" />}
              </button>
              <button
                onClick={() => { setEditBlock(block); setShowModal(true) }}
                className="p-1.5 hover:bg-gray-100 rounded-lg"
                title="Editar"
              >
                <Pencil className="w-4 h-4 text-gray-400" />
              </button>
              <button
                onClick={() => deleteBlock(block.id)}
                className="p-1.5 hover:bg-red-50 rounded-lg"
                title="Eliminar"
              >
                <Trash2 className="w-4 h-4 text-red-400" />
              </button>
            </div>
          </div>
        )
      })}

      {/* Action buttons */}
      <div className="flex gap-3">
        <button
          onClick={() => { setEditBlock(null); setShowModal(true) }}
          className="flex-1 flex items-center justify-center gap-2 p-3 border-2 border-dashed border-gray-300 rounded-xl hover:border-pink-400 hover:bg-pink-50/50 text-sm text-gray-500 hover:text-pink-600 transition-colors"
        >
          <Plus className="w-4 h-4" /> Agregar bloque
        </button>
        <button
          onClick={() => setShowPreview(true)}
          disabled={!branding}
          className="flex items-center gap-2 px-5 py-3 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-800 disabled:opacity-50 transition-colors"
        >
          <Monitor className="w-4 h-4" /> Ver preview
        </button>
      </div>

      {/* Modal */}
      {showModal && (
        <BlockEditModal
          block={editBlock}
          onSave={handleSaveBlock}
          onClose={() => { setShowModal(false); setEditBlock(null) }}
        />
      )}

      {/* Preview */}
      {showPreview && branding && (
        <BlocksPreview
          blocks={blocks}
          branding={{ primary: branding.brand_color || '#ff007c', accent: branding.brand_accent_color || '#ff8017', logo_url: branding.logo_url, name: branding.name || 'Inmobiliaria' }}
          settings={settings}
          onClose={() => setShowPreview(false)}
        />
      )}
    </div>
  )
}
