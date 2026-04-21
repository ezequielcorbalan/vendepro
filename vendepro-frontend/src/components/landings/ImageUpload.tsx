'use client'
import { useState } from 'react'
import { Upload, Link as LinkIcon, Home } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import PropertyPhotoPicker from './PropertyPhotoPicker'

interface Props {
  value: string
  onChange: (url: string, source?: 'upload' | 'external' | 'property', property_id?: string) => void
  allowPropertyPicker?: boolean
}

export default function ImageUpload({ value, onChange, allowPropertyPicker }: Props) {
  const [mode, setMode] = useState<'upload' | 'url' | 'property'>('upload')
  const [uploading, setUploading] = useState(false)
  const [urlInput, setUrlInput] = useState(value || '')
  const [showPicker, setShowPicker] = useState(false)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('prefix', 'landings')
      // api-admin exposes POST /uploads for R2 uploads.
      // If the endpoint doesn't exist yet, this will fail at runtime — acceptable for Fase B.
      const res = await apiFetch('admin', '/uploads', { method: 'POST', body: form } as any)
      if (!res.ok) throw new Error('Upload falló')
      const { url } = (await res.json()) as any
      onChange(url, 'upload')
    } catch (e: any) {
      alert('Error subiendo imagen: ' + e.message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-2">
      {value && (
        <img src={value} alt="" className="w-full h-28 rounded-lg object-cover" />
      )}

      <div className="flex gap-1">
        <button
          type="button"
          onClick={() => setMode('upload')}
          className={`flex-1 text-xs py-1.5 rounded-md ${mode === 'upload' ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:bg-gray-50'}`}
        >
          <Upload className="w-3.5 h-3.5 inline mr-1" /> Subir
        </button>
        <button
          type="button"
          onClick={() => setMode('url')}
          className={`flex-1 text-xs py-1.5 rounded-md ${mode === 'url' ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:bg-gray-50'}`}
        >
          <LinkIcon className="w-3.5 h-3.5 inline mr-1" /> URL
        </button>
        {allowPropertyPicker && (
          <button
            type="button"
            onClick={() => setMode('property')}
            className={`flex-1 text-xs py-1.5 rounded-md ${mode === 'property' ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:bg-gray-50'}`}
          >
            <Home className="w-3.5 h-3.5 inline mr-1" /> Propiedad
          </button>
        )}
      </div>

      {mode === 'upload' && (
        <label className="block">
          <input
            type="file"
            accept="image/*"
            onChange={handleFile}
            disabled={uploading}
            className="hidden"
          />
          <span className="block text-center text-xs py-2 border border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-[#ff007c]">
            {uploading ? 'Subiendo…' : 'Seleccionar archivo'}
          </span>
        </label>
      )}

      {mode === 'url' && (
        <div className="flex gap-1">
          <input
            value={urlInput}
            onChange={e => setUrlInput(e.target.value)}
            placeholder="https://…"
            className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-xs"
          />
          <button
            type="button"
            onClick={() => onChange(urlInput, 'external')}
            className="bg-gray-900 text-white text-xs px-3 rounded-lg"
          >
            Usar
          </button>
        </div>
      )}

      {mode === 'property' && allowPropertyPicker && (
        <>
          <button
            type="button"
            onClick={() => setShowPicker(true)}
            className="w-full text-xs py-2 border border-dashed border-gray-300 rounded-lg hover:border-[#ff007c]"
          >
            Elegir desde una propiedad del CRM
          </button>
          {showPicker && (
            <PropertyPhotoPicker
              onPick={(url, property_id) => {
                onChange(url, 'property', property_id)
                setShowPicker(false)
              }}
              onClose={() => setShowPicker(false)}
            />
          )}
        </>
      )}
    </div>
  )
}
