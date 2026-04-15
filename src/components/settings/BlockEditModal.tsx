'use client'

import { useState } from 'react'
import { X, Loader2 } from 'lucide-react'
import IconPicker from './IconPicker'

interface BlockEditModalProps {
  block: any | null // null = creating new
  onSave: (data: any) => Promise<void>
  onClose: () => void
}

export default function BlockEditModal({ block, onSave, onClose }: BlockEditModalProps) {
  const [form, setForm] = useState({
    title: block?.title || '',
    description: block?.description || '',
    icon: block?.icon || 'Star',
    number_label: block?.number_label || '',
    video_url: block?.video_url || '',
    block_type: block?.block_type || 'service',
    section: block?.section || 'commercial',
  })
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    await onSave(form)
    setSaving(false)
  }

  const inputClass = 'w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-pink-500/30 focus:border-pink-500 outline-none'
  const labelClass = 'block text-sm font-medium text-gray-700 mb-1'

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-800">
            {block ? 'Editar bloque' : 'Nuevo bloque'}
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className={labelClass}>Tipo de bloque</label>
            <select
              className={inputClass}
              value={form.block_type}
              onChange={e => setForm(f => ({ ...f, block_type: e.target.value }))}
            >
              <option value="service">Servicio (numerado)</option>
              <option value="video">Video</option>
              <option value="stats">Datos de mercado</option>
              <option value="text">Texto libre</option>
              <option value="custom">Personalizado</option>
            </select>
          </div>

          <div>
            <label className={labelClass}>Título</label>
            <input
              className={inputClass}
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="Ej: Fotografía profesional HDR"
            />
          </div>

          <div>
            <label className={labelClass}>Descripción</label>
            <textarea
              className={`${inputClass} h-28`}
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Texto que se mostrará en la página..."
            />
          </div>

          {(form.block_type === 'service' || form.block_type === 'custom') && (
            <div>
              <label className={labelClass}>Número (ej: 01, 02)</label>
              <input
                className={inputClass}
                value={form.number_label}
                onChange={e => setForm(f => ({ ...f, number_label: e.target.value }))}
                placeholder="01"
              />
            </div>
          )}

          {(form.block_type === 'video') && (
            <div>
              <label className={labelClass}>URL de YouTube</label>
              <input
                className={inputClass}
                value={form.video_url}
                onChange={e => setForm(f => ({ ...f, video_url: e.target.value }))}
                placeholder="https://youtube.com/watch?v=..."
              />
            </div>
          )}

          <div>
            <label className={labelClass}>Sección</label>
            <select
              className={inputClass}
              value={form.section}
              onChange={e => setForm(f => ({ ...f, section: e.target.value }))}
            >
              <option value="commercial">Propuesta comercial</option>
              <option value="conditions">Condiciones de trabajo</option>
            </select>
          </div>

          <div>
            <label className={labelClass}>Ícono</label>
            <IconPicker value={form.icon} onChange={icon => setForm(f => ({ ...f, icon }))} />
          </div>
        </div>

        <div className="p-5 border-t border-gray-100 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !form.title.trim()}
            className="px-6 py-2.5 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50 flex items-center gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}
