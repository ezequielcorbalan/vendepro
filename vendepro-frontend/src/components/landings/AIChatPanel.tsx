'use client'
import { useState } from 'react'
import { Send, Sparkles, Check, X, Loader2 } from 'lucide-react'
import { aiApi, landingsApi } from '@/lib/landings/api'

type Scope = 'block' | 'global'

interface Msg {
  role: 'user' | 'ai'
  text: string
  proposal?: { kind: 'block'; blockId: string; data: any } | { kind: 'global'; blocks: any[] }
}

interface Props {
  landingId: string
  selectedBlockId: string | null
  onProposalAccepted: () => Promise<void>
}

export default function AIChatPanel({ landingId, selectedBlockId, onProposalAccepted }: Props) {
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [scope, setScope] = useState<Scope>('block')
  const [loading, setLoading] = useState(false)

  async function send() {
    if (!input.trim() || loading) return
    if (scope === 'block' && !selectedBlockId) {
      setMessages(m => [...m, { role: 'ai', text: 'Seleccioná un bloque primero para editarlo con IA.' }])
      return
    }
    const prompt = input.trim().slice(0, 500)
    setInput('')
    setMessages(m => [...m, { role: 'user', text: prompt }])
    setLoading(true)
    try {
      const r = await aiApi.editBlock(landingId, { prompt, scope, blockId: scope === 'block' ? selectedBlockId! : undefined })
      if (r.status === 'error') {
        setMessages(m => [...m, { role: 'ai', text: friendlyError(r.reason) }])
      } else {
        const explanation = r.proposal.kind === 'block' ? 'Listo — propuesta para el bloque seleccionado.' : 'Listo — propuesta global.'
        setMessages(m => [...m, { role: 'ai', text: explanation, proposal: r.proposal as any }])
      }
    } catch (e: any) {
      setMessages(m => [...m, { role: 'ai', text: 'Error de red: ' + (e.message ?? 'desconocido') }])
    } finally {
      setLoading(false)
    }
  }

  async function accept(msg: Msg, idx: number) {
    if (!msg.proposal) return
    if (msg.proposal.kind === 'block') {
      const { landing } = await landingsApi.get(landingId)
      const blockId = msg.proposal.blockId
      const proposalData = msg.proposal.data
      const blocks = landing.blocks.map(b => b.id === blockId ? { ...b, data: proposalData } : b)
      await landingsApi.updateBlocks(landingId, blocks, 'manual-save')
    } else {
      await landingsApi.updateBlocks(landingId, msg.proposal.blocks, 'manual-save')
    }
    setMessages(m => m.map((x, i) => i === idx ? { ...x, proposal: undefined, text: x.text + ' ✓ Aplicada.' } : x))
    await onProposalAccepted()
  }

  function reject(idx: number) {
    setMessages(m => m.map((x, i) => i === idx ? { ...x, proposal: undefined, text: x.text + ' (rechazada)' } : x))
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-gray-100">
        <p className="text-xs uppercase tracking-wider font-semibold text-[#ff007c] flex items-center gap-1.5 mb-2">
          <Sparkles className="w-3.5 h-3.5" /> Chat IA — Groq
        </p>
        <div className="flex gap-1.5">
          <button onClick={() => setScope('block')}
            className={`text-xs px-2.5 py-1 rounded-md ${scope === 'block' ? 'bg-[#ff007c]/10 text-[#ff007c] border border-[#ff007c]/40' : 'bg-gray-100 text-gray-600 border border-transparent'}`}>
            Solo bloque
          </button>
          <button onClick={() => setScope('global')}
            className={`text-xs px-2.5 py-1 rounded-md ${scope === 'global' ? 'bg-[#ff007c]/10 text-[#ff007c] border border-[#ff007c]/40' : 'bg-gray-100 text-gray-600 border border-transparent'}`}>
            Toda la landing
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-3 space-y-2">
        {messages.length === 0 && (
          <p className="text-xs text-gray-400 text-center mt-8">Escribí un pedido y la IA propone cambios (con Aceptar/Rechazar).</p>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`rounded-xl p-3 text-sm ${msg.role === 'user' ? 'bg-[#ff007c]/10 ml-8 text-gray-900' : 'bg-gray-50 mr-8 text-gray-700'}`}>
            <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">{msg.role === 'user' ? 'Vos' : 'Groq · llama-3.3-70b'}</p>
            <p>{msg.text}</p>
            {msg.proposal && (
              <div className="flex gap-2 mt-3">
                <button onClick={() => accept(msg, i)} className="inline-flex items-center gap-1 bg-[#ff007c] hover:bg-[#e60070] text-white text-xs font-semibold px-3 py-1 rounded-full">
                  <Check className="w-3 h-3" /> Aceptar
                </button>
                <button onClick={() => reject(i)} className="inline-flex items-center gap-1 border border-gray-200 text-gray-700 text-xs px-3 py-1 rounded-full hover:bg-gray-50">
                  <X className="w-3 h-3" /> Rechazar
                </button>
              </div>
            )}
          </div>
        ))}
        {loading && <div className="text-xs text-gray-500 flex items-center gap-1.5"><Loader2 className="w-3 h-3 animate-spin" /> Generando…</div>}
      </div>

      <div className="p-3 border-t border-gray-100 flex gap-2">
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()}
          placeholder="Pedile un cambio…" maxLength={500}
          className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#ff007c]" />
        <button onClick={send} disabled={loading || !input.trim()} className="bg-[#ff007c] hover:bg-[#e60070] disabled:opacity-50 text-white rounded-lg px-3">
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

function friendlyError(reason: string): string {
  if (reason === 'schema_mismatch') return 'No pude generar una versión válida. Probá reformular el pedido.'
  if (reason === 'provider_error') return 'La IA está temporalmente saturada. Reintentá en un momento.'
  if (reason === 'timeout') return 'La IA tardó demasiado. Intentá con un pedido más chico.'
  return `Error: ${reason}`
}
