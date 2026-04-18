'use client'
import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, BarChart3, History, Settings, Eye, Send, CheckCircle2, XCircle } from 'lucide-react'
import type { Landing } from '@/lib/landings/types'
import { publicLandingHostPath } from '@/lib/landings/slug'
import StatusBadge from './StatusBadge'

interface Props {
  landing: Landing
  isAdmin: boolean
  dirty: boolean
  saving: boolean
  onOpenVersions: () => void
  onOpenConfig: () => void
  onOpenAnalytics: () => void
  onOpenPreview: () => void
  onRequestPublish: () => Promise<void>
  onPublish: () => Promise<void>
  onRejectPublish: (note: string) => Promise<void>
}

export default function EditorToolbar({ landing, isAdmin, dirty, saving, onOpenVersions, onOpenConfig, onOpenAnalytics, onOpenPreview, onRequestPublish, onPublish, onRejectPublish }: Props) {
  const [busy, setBusy] = useState(false)
  const [showReject, setShowReject] = useState(false)
  const [note, setNote] = useState('')

  async function handle(fn: () => Promise<void>) {
    setBusy(true); try { await fn() } finally { setBusy(false) }
  }

  return (
    <header className="h-14 px-4 flex items-center gap-4 bg-white border-b border-gray-200 sticky top-0 z-30">
      <Link href="/landings" className="p-2 hover:bg-gray-100 rounded-lg"><ArrowLeft className="w-4 h-4" /></Link>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h1 className="font-semibold text-gray-900 truncate">{landing.seo_title || landing.full_slug}</h1>
          <StatusBadge status={landing.status} />
          {saving && <span className="text-xs text-gray-500">Guardando…</span>}
          {!saving && dirty && <span className="text-xs text-amber-600">Sin guardar</span>}
        </div>
        <p className="text-xs text-gray-500 truncate">{publicLandingHostPath(landing.full_slug)}</p>
      </div>

      <button onClick={onOpenVersions} className="p-2 hover:bg-gray-100 rounded-lg" title="Versiones"><History className="w-4 h-4 text-gray-600" /></button>
      <button onClick={onOpenConfig} className="p-2 hover:bg-gray-100 rounded-lg" title="Configuración"><Settings className="w-4 h-4 text-gray-600" /></button>
      <button onClick={onOpenAnalytics} className="p-2 hover:bg-gray-100 rounded-lg" title="Analytics"><BarChart3 className="w-4 h-4 text-gray-600" /></button>
      <button onClick={onOpenPreview} className="p-2 hover:bg-gray-100 rounded-lg" title="Vista previa"><Eye className="w-4 h-4 text-gray-600" /></button>

      {landing.status === 'draft' && !isAdmin && (
        <button onClick={() => handle(onRequestPublish)} disabled={busy} className="inline-flex items-center gap-2 bg-[#ff007c] hover:bg-[#e60070] text-white text-sm font-semibold px-4 py-2 rounded-full disabled:opacity-60">
          <Send className="w-4 h-4" /> Solicitar publicación
        </button>
      )}
      {landing.status === 'draft' && isAdmin && (
        <button onClick={() => handle(onPublish)} disabled={busy} className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-4 py-2 rounded-full disabled:opacity-60">
          <CheckCircle2 className="w-4 h-4" /> Publicar
        </button>
      )}
      {landing.status === 'pending_review' && isAdmin && (
        <div className="flex items-center gap-2">
          <button onClick={() => handle(onPublish)} disabled={busy} className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-4 py-2 rounded-full">
            <CheckCircle2 className="w-4 h-4" /> Aprobar y publicar
          </button>
          <button onClick={() => setShowReject(true)} className="inline-flex items-center gap-2 border border-gray-200 text-gray-700 text-sm font-semibold px-4 py-2 rounded-full hover:bg-gray-50">
            <XCircle className="w-4 h-4" /> Rechazar
          </button>
        </div>
      )}

      {showReject && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowReject(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-gray-900 mb-3">Rechazar solicitud</h3>
            <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Nota para el agente (opcional)…"
              className="w-full border border-gray-200 rounded-xl p-3 text-sm resize-none h-28 focus:outline-none focus:border-[#ff007c]" />
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setShowReject(false)} className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-full">Cancelar</button>
              <button onClick={() => { handle(() => onRejectPublish(note)); setShowReject(false) }} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-full">Rechazar</button>
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
