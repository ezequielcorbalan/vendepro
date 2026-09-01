'use client'
import { useToast } from '@/components/ui/Toast'
import { useState } from 'react'
import { Upload, Link as LinkIcon, Home } from 'lucide-react'
import { apiFetch, getApiBase } from '@/lib/api'
import PropertyPhotoPicker from './PropertyPhotoPicker'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { SegmentedControl } from '@/components/ui/SegmentedControl'

interface Props {
  value: string
  onChange: (url: string, source?: 'upload' | 'external' | 'property', property_id?: string) => void
  allowPropertyPicker?: boolean
}

export default function ImageUpload({ value, onChange, allowPropertyPicker }: Props) {
  const { toast } = useToast()
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
      const res = await apiFetch('properties', '/upload-photo', { method: 'POST', body: form } as any)
      if (!res.ok) throw new Error('Upload falló')
      const { key, url: rawUrl } = (await res.json()) as any
      // Preferimos el proxy público /photo/{key} sobre el mismo worker en lugar de
      // confiar en R2_PUBLIC_URL (que puede estar mal configurado en el worker).
      const url = key ? `${getApiBase('properties')}/photo/${key}` : rawUrl
      onChange(url, 'upload')
    } catch (e: any) {
      toast('Error subiendo imagen: ' + e.message, 'error')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-2">
      {value && (
        <img src={value} alt="" className="w-full h-28 rounded-control object-cover" />
      )}

      <SegmentedControl
        className="w-full"
        value={mode}
        onChange={v => setMode(v as typeof mode)}
        options={[
          { value: 'upload', label: 'Subir', icon: <Upload className="w-3.5 h-3.5" /> },
          { value: 'url', label: 'URL', icon: <LinkIcon className="w-3.5 h-3.5" /> },
          ...(allowPropertyPicker ? [{ value: 'property', label: 'Propiedad', icon: <Home className="w-3.5 h-3.5" /> }] : []),
        ]}
      />

      {mode === 'upload' && (
        <label className="block">
          <input
            type="file"
            accept="image/*"
            onChange={handleFile}
            disabled={uploading}
            className="hidden"
          />
          <span className="block text-center text-xs py-2 border border-dashed border-gray-300 rounded-control cursor-pointer hover:border-primary">
            {uploading ? 'Subiendo…' : 'Seleccionar archivo'}
          </span>
        </label>
      )}

      {mode === 'url' && (
        <div className="flex gap-1">
          <Input
            value={urlInput}
            onChange={e => setUrlInput(e.target.value)}
            placeholder="https://…"
            className="flex-1 px-2 py-1.5 text-xs"
          />
          <Button variant="outline" size="sm" onClick={() => onChange(urlInput, 'external')}>
            Usar
          </Button>
        </div>
      )}

      {mode === 'property' && allowPropertyPicker && (
        <>
          <Button
            variant="outline"
            size="sm"
            fullWidth
            onClick={() => setShowPicker(true)}
            className="border-dashed text-xs hover:border-primary"
          >
            Elegir desde una propiedad del CRM
          </Button>
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
