'use client'
import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import AIChatPanel from './AIChatPanel'

export default function AIFloatingButton() {
  const [open, setOpen] = useState(false)

  return (
    <>
      {/* Floating button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-40 w-14 h-14 bg-gradient-to-br from-[#ff007c] to-[#ff8017] text-white rounded-full shadow-lg hover:shadow-xl hover:scale-105 transition-all flex items-center justify-center group"
          title="Asistente IA"
        >
          <Sparkles className="w-6 h-6 group-hover:rotate-12 transition-transform" />
        </button>
      )}

      {/* Chat panel */}
      {open && <AIChatPanel onClose={() => setOpen(false)} />}
    </>
  )
}
