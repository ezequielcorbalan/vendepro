'use client'

import { useState, useEffect } from 'react'
import { Sparkles } from 'lucide-react'
import AIChatPanel from './AIChatPanel'

export default function AIFloatingButton() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(prev => !prev)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Asistente IA (Ctrl+K)"
        className="fixed bottom-6 right-6 z-40 bg-gradient-to-br from-brand-pink to-brand-orange text-white rounded-full p-3.5 shadow-lg hover:opacity-90 hover:scale-105 transition-all"
      >
        <Sparkles size={20} />
      </button>
      {open && <AIChatPanel onClose={() => setOpen(false)} />}
    </>
  )
}
