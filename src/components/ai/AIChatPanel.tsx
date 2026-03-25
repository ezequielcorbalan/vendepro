'use client'
import { useState, useRef, useCallback } from 'react'
import {
  Sparkles, Send, X, Mic, MicOff, Clipboard, Loader2,
  User, Phone, MapPin, Home, Calendar, FileText, CheckCircle2,
  AlertTriangle, ChevronDown, ChevronUp, Pencil
} from 'lucide-react'
import { useToast } from '@/components/ui/Toast'

type Intent = {
  action: string; confidence: number; data: any; missing_fields: string[];
  reasoning?: string; matches?: any[]; suggested_action?: string; suggested_lead_id?: string; suggestion_reason?: string
}
type Step = 'input' | 'processing' | 'confirm' | 'done'

const ACTION_LABELS: Record<string, { label: string; icon: any; color: string }> = {
  create_lead:       { label: 'Crear lead',         icon: User,          color: 'bg-blue-50 text-blue-700 border-blue-200' },
  update_lead:       { label: 'Actualizar lead',    icon: Pencil,        color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  create_activity:   { label: 'Registrar actividad', icon: Phone,        color: 'bg-green-50 text-green-700 border-green-200' },
  create_appraisal:  { label: 'Crear tasación',     icon: Home,          color: 'bg-pink-50 text-pink-700 border-pink-200' },
  schedule_followup: { label: 'Agendar seguimiento', icon: Calendar,     color: 'bg-orange-50 text-orange-700 border-orange-200' },
  append_note:       { label: 'Agregar nota',       icon: FileText,      color: 'bg-gray-50 text-gray-700 border-gray-200' },
}

const FIELD_LABELS: Record<string, string> = {
  full_name: 'Nombre', phone: 'Teléfono', email: 'Email', operation: 'Operación',
  property_type: 'Tipo', rooms: 'Ambientes', neighborhood: 'Barrio', address: 'Dirección',
  estimated_value: 'Valor estimado', source: 'Origen', notes: 'Notas', next_step: 'Próximo paso',
  next_step_date: 'Fecha próx. paso', activity_type: 'Tipo actividad', description: 'Descripción',
  result: 'Resultado', lead_name: 'Lead vinculado', contact_name: 'Contacto', contact_phone: 'Tel contacto',
  covered_area: 'Sup. cubierta', total_area: 'Sup. total', title: 'Título', event_type: 'Tipo evento',
  start_date: 'Fecha', start_time: 'Hora', note_text: 'Nota', lead_identifier: 'Buscar lead',
}

export default function AIChatPanel({ context, onClose }: {
  context?: { module?: string; entity_id?: string; entity_data?: any }
  onClose: () => void
}) {
  const { toast } = useToast()
  const [step, setStep] = useState<Step>('input')
  const [mode, setMode] = useState<'chat' | 'paste'>('chat')
  const [text, setText] = useState('')
  const [intents, setIntents] = useState<Intent[]>([])
  const [editingIdx, setEditingIdx] = useState<number | null>(null)
  const [recording, setRecording] = useState(false)
  const [saving, setSaving] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const mediaRecorder = useRef<MediaRecorder | null>(null)
  const audioChunks = useRef<Blob[]>([])

  // ── Process text ──
  const handleProcess = useCallback(async (inputText: string) => {
    if (!inputText.trim()) return
    setStep('processing')
    try {
      const res = await fetch('/api/ai/process', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: inputText, source: mode, context }),
      })
      const data = ((await res.json()) as any) as any
      if (data.intents?.length > 0) {
        setIntents(data.intents)
        setStep('confirm')
      } else {
        toast(data.error || 'No pude interpretar el mensaje', 'warning')
        setStep('input')
      }
    } catch {
      toast('Error al procesar', 'error')
      setStep('input')
    }
  }, [mode, context, toast])

  // ── Record audio ──
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      audioChunks.current = []
      recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunks.current.push(e.data) }
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        const blob = new Blob(audioChunks.current, { type: 'audio/webm' })
        setTranscribing(true)
        try {
          const form = new FormData()
          form.append('audio', blob, 'recording.webm')
          const res = await fetch('/api/ai/transcribe', { method: 'POST', body: form })
          const data = (await res.json()) as any
          if (data.text) {
            setText(data.text)
            toast('Audio transcripto', 'success')
          } else {
            toast(data.error || 'No se pudo transcribir', 'error')
          }
        } catch { toast('Error de transcripción', 'error') }
        finally { setTranscribing(false) }
      }
      recorder.start()
      mediaRecorder.current = recorder
      setRecording(true)
    } catch { toast('No se pudo acceder al micrófono', 'error') }
  }

  const stopRecording = () => {
    mediaRecorder.current?.stop()
    setRecording(false)
  }

  // ── Confirm & save ──
  const handleConfirm = async (indices: number[]) => {
    setSaving(true)
    const toConfirm = indices.map(i => intents[i])
    try {
      const res = await fetch('/api/ai/confirm', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intents: toConfirm }),
      })
      const data = (await res.json()) as any
      const total = Object.values(data.created || {}).flat().length
      toast(`${total} registro${total !== 1 ? 's' : ''} guardado${total !== 1 ? 's' : ''} ✓`, 'success')

      // Remove confirmed intents, keep the rest
      const remaining = intents.filter((_, i) => !indices.includes(i))
      if (remaining.length === 0) {
        setStep('done')
        setTimeout(() => { onClose() }, 1500)
      } else {
        setIntents(remaining)
        setEditingIdx(null)
      }
    } catch {
      toast('Error al guardar', 'error')
    } finally { setSaving(false) }
  }

  // ── Edit intent data ──
  const updateIntentField = (idx: number, field: string, value: any) => {
    setIntents(prev => prev.map((intent, i) =>
      i === idx ? { ...intent, data: { ...intent.data, [field]: value } } : intent
    ))
  }

  // ── Confidence badge ──
  const ConfBadge = ({ c }: { c: number }) => {
    const pct = Math.round(c * 100)
    const color = pct >= 90 ? 'bg-green-100 text-green-700' : pct >= 70 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
    return <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${color}`}>{pct}%</span>
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-full sm:w-[440px] max-h-[85vh] bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gradient-to-r from-[#ff007c]/5 to-[#ff8017]/5">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[#ff007c]" />
            <span className="font-semibold text-gray-800 text-sm">Asistente IA</span>
            {context?.module && (
              <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{context.module}</span>
            )}
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-4 h-4 text-gray-400" /></button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* ── INPUT STEP ── */}
          {step === 'input' && (
            <div className="space-y-3">
              {/* Mode tabs */}
              <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
                <button onClick={() => setMode('chat')}
                  className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${mode === 'chat' ? 'bg-white shadow text-gray-800' : 'text-gray-500'}`}>
                  💬 Chat
                </button>
                <button onClick={() => setMode('paste')}
                  className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${mode === 'paste' ? 'bg-white shadow text-gray-800' : 'text-gray-500'}`}>
                  📋 Pegar mensaje
                </button>
              </div>

              {mode === 'chat' ? (
                <div className="space-y-2">
                  <p className="text-xs text-gray-400">Contá qué pasó y el sistema lo interpreta</p>
                  <textarea
                    value={text} onChange={e => setText(e.target.value)}
                    placeholder="Ej: Llamé a Juan, quiere vender un 3 amb en Villa Urquiza..."
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm resize-none focus:ring-2 focus:ring-[#ff007c]/20 focus:border-[#ff007c]"
                    rows={4}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleProcess(text) } }}
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-gray-400">Pegá un mensaje de WhatsApp, Telegram o cualquier chat</p>
                  <textarea
                    value={text} onChange={e => setText(e.target.value)}
                    placeholder="Pegá el mensaje acá..."
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm resize-none focus:ring-2 focus:ring-[#ff007c]/20 focus:border-[#ff007c] font-mono text-xs"
                    rows={6}
                  />
                </div>
              )}

              {transcribing && (
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <Loader2 className="w-3 h-3 animate-spin" /> Transcribiendo audio...
                </div>
              )}
            </div>
          )}

          {/* ── PROCESSING ── */}
          {step === 'processing' && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-10 h-10 border-4 border-[#ff007c] border-t-transparent rounded-full animate-spin mb-3" />
              <p className="text-sm text-gray-500">Interpretando mensaje...</p>
            </div>
          )}

          {/* ── CONFIRM STEP ── */}
          {step === 'confirm' && (
            <div className="space-y-3">
              <p className="text-xs text-gray-500">Revisá lo que interpreté y confirmá:</p>

              {intents.map((intent, idx) => {
                const cfg = ACTION_LABELS[intent.action] || ACTION_LABELS.append_note
                const Icon = cfg.icon
                const isEditing = editingIdx === idx

                return (
                  <div key={idx} className={`border rounded-xl overflow-hidden ${cfg.color}`}>
                    {/* Header */}
                    <div className="flex items-center justify-between px-3 py-2">
                      <div className="flex items-center gap-2">
                        <Icon className="w-4 h-4" />
                        <span className="text-xs font-semibold">{cfg.label}</span>
                        <ConfBadge c={intent.confidence} />
                      </div>
                      <button onClick={() => setEditingIdx(isEditing ? null : idx)} className="p-1 hover:bg-white/50 rounded">
                        {isEditing ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>
                    </div>

                    {/* Suggestion banner */}
                    {intent.suggestion_reason && (
                      <div className="px-3 py-1.5 bg-yellow-50 border-t border-yellow-200 flex items-center gap-1.5">
                        <AlertTriangle className="w-3 h-3 text-yellow-600" />
                        <span className="text-[10px] text-yellow-700">{intent.suggestion_reason}</span>
                      </div>
                    )}

                    {/* Summary */}
                    <div className="px-3 py-2 bg-white/60 text-xs text-gray-600 space-y-0.5">
                      {Object.entries(intent.data || {}).filter(([, v]) => v != null && v !== '').slice(0, isEditing ? 99 : 4).map(([key, val]) => (
                        <div key={key} className="flex items-center gap-2">
                          <span className="text-gray-400 w-24 flex-shrink-0">{FIELD_LABELS[key] || key}</span>
                          {isEditing ? (
                            <input value={String(val)} onChange={e => updateIntentField(idx, key, e.target.value)}
                              className="flex-1 border border-gray-200 rounded px-2 py-0.5 text-xs bg-white" />
                          ) : (
                            <span className="font-medium text-gray-700 truncate">{String(val)}</span>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Missing fields warning */}
                    {intent.missing_fields?.length > 0 && (
                      <div className="px-3 py-1.5 bg-amber-50/50 border-t border-amber-100 text-[10px] text-amber-600">
                        ⚠ Falta: {intent.missing_fields.join(', ')}
                      </div>
                    )}

                    {/* Actions */}
                    <div className="px-3 py-2 bg-white border-t border-gray-100 flex gap-2">
                      <button onClick={() => handleConfirm([idx])} disabled={saving}
                        className="flex-1 bg-[#ff007c] text-white text-xs font-medium py-1.5 rounded-lg hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-1">
                        {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                        Confirmar
                      </button>
                      <button onClick={() => setEditingIdx(isEditing ? null : idx)}
                        className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-600 hover:bg-gray-50">
                        {isEditing ? 'Listo' : 'Editar'}
                      </button>
                      <button onClick={() => setIntents(prev => prev.filter((_, i) => i !== idx))}
                        className="px-3 py-1.5 text-xs text-red-500 hover:bg-red-50 rounded-lg">
                        ✕
                      </button>
                    </div>
                  </div>
                )
              })}

              {intents.length > 1 && (
                <button onClick={() => handleConfirm(intents.map((_, i) => i))} disabled={saving}
                  className="w-full bg-gray-800 text-white text-sm font-medium py-2.5 rounded-xl hover:bg-gray-700 disabled:opacity-50 flex items-center justify-center gap-2">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  Confirmar todo ({intents.length})
                </button>
              )}

              <button onClick={() => { setStep('input'); setIntents([]) }}
                className="w-full text-xs text-gray-400 hover:text-gray-600 py-1">
                ← Volver a escribir
              </button>
            </div>
          )}

          {/* ── DONE ── */}
          {step === 'done' && (
            <div className="flex flex-col items-center justify-center py-12">
              <CheckCircle2 className="w-12 h-12 text-green-500 mb-2" />
              <p className="text-sm font-medium text-gray-800">Guardado ✓</p>
            </div>
          )}
        </div>

        {/* Footer — input actions */}
        {step === 'input' && (
          <div className="px-4 py-3 border-t border-gray-100 flex items-center gap-2">
            <button
              onClick={recording ? stopRecording : startRecording}
              disabled={transcribing}
              className={`p-2.5 rounded-xl transition-colors ${recording ? 'bg-red-500 text-white animate-pulse' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
            >
              {recording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>
            <button onClick={() => handleProcess(text)} disabled={!text.trim() || transcribing}
              className="flex-1 bg-[#ff007c] text-white py-2.5 rounded-xl text-sm font-medium hover:opacity-90 disabled:opacity-40 flex items-center justify-center gap-2">
              <Send className="w-4 h-4" /> Procesar
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
