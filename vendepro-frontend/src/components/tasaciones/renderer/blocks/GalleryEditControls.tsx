'use client'
import { useToast } from '@/components/ui/Toast'
import { useState } from 'react'
import { ImagePlus, Loader2 } from 'lucide-react'
import { apiFetch, getApiBase } from '@/lib/api'

interface Props {
  onAdd: (images: Array<{ url: string }>) => void
}

// Sube varias imágenes de una (input multiple) a la API `properties`
// (/upload-photo → {key,url}) y devuelve las URLs para agregarlas a la galería.
export function GalleryEditControls({ onAdd }: Props) {
  const { toast } = useToast()
  const [uploading, setUploading] = useState(false)

  async function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (files.length === 0) return
    setUploading(true)
    try {
      const uploaded = await Promise.all(files.map(async (file) => {
        const form = new FormData()
        form.append('file', file)
        const res = await apiFetch('properties', '/upload-photo', { method: 'POST', body: form } as any)
        if (!res.ok) throw new Error('Upload falló')
        const { key, url: rawUrl } = (await res.json()) as any
        return { url: key ? `${getApiBase('properties')}/photo/${key}` : rawUrl }
      }))
      onAdd(uploaded)
    } catch (err: any) {
      toast('Error subiendo imágenes: ' + (err?.message ?? 'desconocido'), 'error')
    } finally {
      setUploading(false)
      e.target.value = '' // permite volver a elegir los mismos archivos
    }
  }

  return (
    <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 text-slate-400 hover:border-brand-pink hover:text-brand-pink">
      <input type="file" accept="image/*" multiple onChange={handleFiles} disabled={uploading} className="hidden" />
      {uploading ? <Loader2 className="h-6 w-6 animate-spin" /> : <ImagePlus className="h-6 w-6" />}
      <span className="px-1 text-center text-[11px]">{uploading ? 'Subiendo…' : 'Agregar imágenes'}</span>
    </label>
  )
}
