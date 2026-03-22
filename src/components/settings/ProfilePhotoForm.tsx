'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Save, Loader2 } from 'lucide-react'

export default function ProfilePhotoForm({ userId, currentName, currentPhoto }: { userId: string; currentName: string; currentPhoto: string }) {
  const [photoUrl, setPhotoUrl] = useState(currentPhoto)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const router = useRouter()

  async function handleSave() {
    setSaving(true)
    await fetch('/api/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ photo_url: photoUrl }),
    })
    setSaving(false)
    setSaved(true)
    router.refresh()
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        {photoUrl ? (
          <img src={photoUrl} alt={currentName} className="w-16 h-16 rounded-full object-cover" />
        ) : (
          <div className="w-16 h-16 rounded-full bg-brand-pink/20 flex items-center justify-center text-brand-pink font-bold text-xl">
            {currentName.charAt(0).toUpperCase()}
          </div>
        )}
        <div>
          <p className="font-medium text-gray-800">{currentName}</p>
          <p className="text-xs text-gray-400">Esta foto aparece en las tasaciones</p>
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">URL de foto de perfil</label>
        <input
          type="url"
          value={photoUrl}
          onChange={(e) => setPhotoUrl(e.target.value)}
          placeholder="https://ejemplo.com/mi-foto.jpg"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-pink/50"
        />
        <p className="text-xs text-gray-400 mt-1">Pod&eacute;s subir tu foto a un servicio como imgur.com y pegar el link</p>
      </div>
      <button
        onClick={handleSave}
        disabled={saving}
        className="inline-flex items-center gap-2 bg-brand-pink text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        {saved ? '¡Guardado!' : 'Guardar foto'}
      </button>
    </div>
  )
}
