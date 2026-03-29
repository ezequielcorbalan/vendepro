'use client'
import { useState, useRef } from 'react'
import { Camera, Plus, Trash2, Loader2, X } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'

export default function PropertyPhotos({ propertyId }: { propertyId: string }) {
  const { toast } = useToast()
  const [photos, setPhotos] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Load photos on mount
  useState(() => {
    fetch(`/api/upload-photo?property_id=${propertyId}`)
      .then(r => (r.json()) as Promise<any>)
      .then(d => { if (d.photos) setPhotos(d.photos) })
      .catch(() => {})
  })

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    setUploading(true)

    for (const file of Array.from(files)) {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('property_id', propertyId)
      formData.append('type', 'property_photo')

      try {
        const res = await fetch('/api/upload-photo', { method: 'POST', body: formData })
        const data = (await res.json()) as any
        if (data.url) {
          setPhotos(prev => [...prev, data.url])
        }
      } catch {
        toast('Error al subir foto', 'error')
      }
    }
    setUploading(false)
    toast(`${files.length} foto${files.length > 1 ? 's' : ''} subida${files.length > 1 ? 's' : ''}`)
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div className="bg-white rounded-xl shadow-sm p-4 sm:p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-gray-800 flex items-center gap-2">
          <Camera className="w-4 h-4 text-purple-500" /> Fotos
        </h2>
        <label className="cursor-pointer inline-flex items-center gap-1.5 text-xs font-medium text-[#ff007c] hover:text-[#ff8017]">
          {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
          Agregar
          <input ref={inputRef} type="file" multiple accept="image/*" onChange={handleUpload} className="hidden" />
        </label>
      </div>

      {photos.length === 0 ? (
        <div className="text-center py-6">
          <Camera className="w-10 h-10 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-400 mb-3">Sin fotos de la propiedad</p>
          <label className="cursor-pointer inline-flex items-center gap-1.5 bg-gray-100 text-gray-600 px-4 py-2 rounded-lg text-sm hover:bg-gray-200">
            <Plus className="w-4 h-4" /> Subir fotos
            <input ref={inputRef} type="file" multiple accept="image/*" onChange={handleUpload} className="hidden" />
          </label>
        </div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {photos.map((url, i) => (
            <div key={i} className="relative aspect-square rounded-lg overflow-hidden bg-gray-100 group cursor-pointer"
              onClick={() => setPreview(url)}>
              <img src={`/api/photo/${url}`} alt="" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
            </div>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {preview && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setPreview(null)}>
          <button className="absolute top-4 right-4 text-white p-2 hover:bg-white/20 rounded-full">
            <X className="w-6 h-6" />
          </button>
          <img src={`/api/photo/${preview}`} alt="" className="max-w-full max-h-[90vh] rounded-lg" />
        </div>
      )}
    </div>
  )
}
