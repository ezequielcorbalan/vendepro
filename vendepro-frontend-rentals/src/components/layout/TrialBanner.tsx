'use client'

import { useState } from 'react'
import { X } from 'lucide-react'

export default function TrialBanner() {
  const [dismissed, setDismissed] = useState(false)
  if (dismissed) return null
  return (
    <div className="flex items-center justify-between px-4 py-2 text-white text-xs font-medium" style={{ background: '#ff8017' }}>
      <span>Estás en el período de prueba gratuito. <a href="/account" className="underline font-semibold">Activar plan completo</a></span>
      <button onClick={() => setDismissed(true)} className="ml-4 opacity-80 hover:opacity-100">
        <X size={14} />
      </button>
    </div>
  )
}
