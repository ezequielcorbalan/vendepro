'use client'

import { useState } from 'react'
import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, useSortable, arrayMove, rectSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Loader2, X, Upload, GripVertical } from 'lucide-react'
import { apiFetch } from '@/lib/api'

interface Photo {
  id: string
  url: string
  sort_order: number
}

interface PhotoGalleryProps {
  photos: Photo[]
  propertyId: string
  editable?: boolean
}

function SortablePhoto({ photo, onDelete }: { photo: Photo; onDelete: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: photo.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }

  return (
    <div ref={setNodeRef} style={style} className="relative group aspect-square rounded-xl overflow-hidden bg-gray-100">
      <img src={photo.url} alt="" className="w-full h-full object-cover" />
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors">
        <button {...attributes} {...listeners}
          className="absolute top-2 left-2 bg-white/90 rounded p-1 opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing">
          <GripVertical className="w-3 h-3 text-gray-600" />
        </button>
        <button type="button" onClick={() => onDelete(photo.id)}
          className="absolute top-2 right-2 bg-white/90 rounded-full p-1 opacity-0 group-hover:opacity-100 hover:bg-red-50">
          <X className="w-3 h-3 text-gray-600 hover:text-red-500" />
        </button>
      </div>
    </div>
  )
}

export function PhotoGallery({ photos: initialPhotos, propertyId, editable = false }: PhotoGalleryProps) {
  const [photos, setPhotos] = useState<Photo[]>(initialPhotos)
  const [uploading, setUploading] = useState(false)

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    setUploading(true)
    for (const file of files) {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('property_id', propertyId)
      try {
        const res = await apiFetch('properties', '/property-photos', { method: 'POST', body: fd })
        const data = (await res.json()) as any
        if (data.id) setPhotos(prev => [...prev, { id: data.id, url: data.url, sort_order: data.sort_order }])
      } catch {}
    }
    setUploading(false)
    e.target.value = ''
  }

  async function handleDelete(id: string) {
    try {
      const res = await apiFetch('properties', `/property-photos/${id}`, { method: 'DELETE' })
      if (res.ok) setPhotos(prev => prev.filter(p => p.id !== id))
    } catch {}
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIdx = photos.findIndex(p => p.id === active.id)
    const newIdx = photos.findIndex(p => p.id === over.id)
    const reordered = arrayMove(photos, oldIdx, newIdx)
    const previous = photos
    setPhotos(reordered)
    try {
      await apiFetch('properties', '/property-photos/reorder', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reordered.map((p, i) => ({ id: p.id, sort_order: i }))),
      })
    } catch {
      setPhotos(previous)
    }
  }

  if (!photos.length && !editable) return null

  if (!editable) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {photos.map(p => (
          <div key={p.id} className="aspect-square rounded-xl overflow-hidden bg-gray-100">
            <img src={p.url} alt="" className="w-full h-full object-cover" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {photos.length > 0 && (
        <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={photos.map(p => p.id)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {photos.map(p => (
                <SortablePhoto key={p.id} photo={p} onDelete={handleDelete} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
      <label className={`flex items-center gap-2 border-2 border-dashed rounded-xl p-4 cursor-pointer transition-colors ${uploading ? 'border-gray-200 opacity-60' : 'border-gray-300 hover:border-[#ff007c]/50'}`}>
        {uploading
          ? <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
          : <Upload className="w-4 h-4 text-gray-400" />}
        <span className="text-sm text-gray-500">{uploading ? 'Subiendo...' : 'Agregar fotos'}</span>
        <input type="file" accept="image/*" multiple onChange={handleUpload} className="hidden" disabled={uploading} />
      </label>
    </div>
  )
}
