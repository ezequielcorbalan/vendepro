'use client'
import { useToast } from '@/components/ui/Toast'
import { useState } from 'react'
import { Upload, Link as LinkIcon } from 'lucide-react'
import { apiFetch, getApiBase } from '@/lib/api'

interface Props {
  onUploaded: (url: string) => void
  /** compact = solo botón "Cambiar" (cuando ya hay imagen). */
  compact?: boolean
}

// Sube a la API `properties` (/upload-photo → {key,url}) y prefiere el proxy
// público /photo/{key} del mismo worker (mismo patrón que landings/ImageUpload).
export function ImageEditControls({ onUploaded, compact }: Props) {
  const { toast } = useToast()
  const [uploading, setUploading] = useState(false)
  const [mode, setMode] = useState<'upload' | 'url'>('upload')
  const [urlInput, setUrlInput] = useState('')

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await apiFetch('properties', '/upload-photo', { method: 'POST', body: form } as any)
      if (!res.ok) throw new Error('Upload falló')
      const { key, url: rawUrl } = (await res.json()) as any
      onUploaded(key ? `${getApiBase('properties')}/photo/${key}` : rawUrl)
    } catch (err: any) {
      toast('Error subiendo imagen: ' + (err?.message ?? 'desconocido'), 'error')
    } finally {
      setUploading(false)
    }
  }

  if (compact) {
    return (
      <label className="inline-flex cursor-pointer items-center gap-1 rounded border border-slate-300 bg-white/90 px-2 py-1 text-xs text-slate-600 hover:border-brand-pink">
        <input type="file" accept="image/*" onChange={handleFile} disabled={uploading} className="hidden" />
        <Upload className="h-3 w-3" /> {uploading ? 'Subiendo…' : 'Cambiar imagen'}
      </label>
    )
  }

  return (
    <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-6">
      <div className="mb-3 flex justify-center gap-1">
        <button type="button" onClick={() => setMode('upload')} className={`rounded-md px-3 py-1 text-xs ${mode === 'upload' ? 'bg-white text-ink shadow-sm' : 'text-slate-500'}`}>
          <Upload className="mr-1 inline h-3 w-3" /> Subir
        </button>
        <button type="button" onClick={() => setMode('url')} className={`rounded-md px-3 py-1 text-xs ${mode === 'url' ? 'bg-white text-ink shadow-sm' : 'text-slate-500'}`}>
          <LinkIcon className="mr-1 inline h-3 w-3" /> URL
        </button>
      </div>
      {mode === 'upload' ? (
        <label className="block cursor-pointer text-center text-sm text-slate-500">
          <input type="file" accept="image/*" onChange={handleFile} disabled={uploading} className="hidden" />
          <span className="rounded-lg bg-white px-4 py-2 shadow-sm hover:text-brand-pink">
            {uploading ? 'Subiendo…' : 'Seleccionar imagen'}
          </span>
        </label>
      ) : (
        <div className="flex justify-center gap-1">
          <input value={urlInput} onChange={(e) => setUrlInput(e.target.value)} placeholder="https://…" className="w-64 rounded-lg border border-slate-200 px-2 py-1.5 text-xs" />
          <button type="button" onClick={() => urlInput && onUploaded(urlInput)} className="rounded-lg bg-slate-900 px-3 text-xs text-white">Usar</button>
        </div>
      )}
    </div>
  )
}
