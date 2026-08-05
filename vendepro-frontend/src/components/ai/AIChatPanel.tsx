'use client'

import { useState, useEffect, useRef } from 'react'
import {
  X, Sparkles, Loader2, CheckCircle, User, Phone, Mail,
  MapPin, DollarSign, Home, FileText, ArrowLeft, Plus,
  Type, FileImage, ClipboardPaste,
} from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'

type Mode = 'text' | 'image'
type Step = 'input' | 'review' | 'done'

interface ExtractedFields {
  full_name?: string
  phone?: string
  email?: string
  neighborhood?: string
  property_type?: string
  operation?: string
  notes?: string
  budget?: string
}

interface ImageData {
  base64: string
  mimeType: string
  previewUrl: string
}

function normalizeOperation(op?: string): string {
  if (!op) return 'venta'
  const o = op.toLowerCase()
  if (o.includes('alquil') || o.includes('rent')) return 'alquiler'
  if (o.includes('venta') || o.includes('vend') || o.includes('compra')) return 'venta'
  return 'venta'
}

function Field({
  icon, label, value, onChange, placeholder,
}: {
  icon: React.ReactNode
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <div>
      <label className="text-xs text-gray-600 mb-1 flex items-center gap-1.5">
        <span className="text-gray-400">{icon}</span>
        {label}
      </label>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none placeholder:text-gray-400"
      />
    </div>
  )
}

export default function AIChatPanel(_props: {
  leadId?: string
  context?: Record<string, string>
  onClose?: () => void
}) {
  const { onClose } = _props
  const { toast } = useToast()
  const [mode, setMode] = useState<Mode>('text')
  const [step, setStep] = useState<Step>('input')
  const [text, setText] = useState('')
  const [imageData, setImageData] = useState<ImageData | null>(null)
  const [loading, setLoading] = useState(false)
  const [fields, setFields] = useState<ExtractedFields>({})
  const [creating, setCreating] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (mode === 'text') textareaRef.current?.focus()
  }, [mode])

  // detect image paste globally while panel is open
  useEffect(() => {
    const handler = (e: ClipboardEvent) => {
      if (step !== 'input') return
      const items = e.clipboardData?.items
      if (!items) return
      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          e.preventDefault()
          const file = item.getAsFile()
          if (!file) return
          const reader = new FileReader()
          reader.onload = ev => {
            const dataUrl = ev.target?.result as string
            setImageData({ base64: dataUrl.split(',')[1], mimeType: item.type, previewUrl: dataUrl })
            setMode('image')
          }
          reader.readAsDataURL(file)
          return
        }
      }
    }
    document.addEventListener('paste', handler)
    return () => document.removeEventListener('paste', handler)
  }, [step])

  const extract = async () => {
    if (!text.trim()) return
    setLoading(true)
    try {
      const res = await apiFetch('ai', '/extract-entity', {
        method: 'POST',
        body: JSON.stringify({ text }),
      })
      const data = (await res.json()) as any
      setFields(data.fields ?? {})
      setStep('review')
    } catch {
      toast('Error al extraer datos. Intentá de nuevo.', 'error')
    }
    setLoading(false)
  }

  const extractImage = async () => {
    if (!imageData) return
    setLoading(true)
    try {
      const res = await apiFetch('ai', '/extract-image', {
        method: 'POST',
        body: JSON.stringify({ imageBase64: imageData.base64, mimeType: imageData.mimeType }),
      })
      const data = (await res.json()) as any
      setFields(data.fields ?? {})
      setStep('review')
    } catch {
      toast('Error al procesar la imagen. Intentá de nuevo.', 'error')
    }
    setLoading(false)
  }

  const createLead = async () => {
    if (!fields.full_name?.trim()) {
      toast('El nombre es requerido', 'error')
      return
    }
    setCreating(true)
    try {
      const notes = [
        fields.property_type ? `Tipo de propiedad: ${fields.property_type}` : '',
        fields.notes ?? '',
      ].filter(Boolean).join('\n')

      const res = await apiFetch('crm', '/leads', {
        method: 'POST',
        body: JSON.stringify({
          source: 'ai_assistant',
          neighborhood: fields.neighborhood ?? '',
          operation: normalizeOperation(fields.operation),
          notes,
          estimated_value: fields.budget ?? '',
          contact_data: {
            full_name: fields.full_name.trim(),
            phone: fields.phone || null,
            email: fields.email || null,
            contact_type: 'comprador',
          },
        }),
      })
      const data = (await res.json()) as any
      if (data.id) {
        setStep('done')
        toast('Lead creado correctamente')
      } else {
        toast(data.error ?? 'Error al crear lead', 'error')
      }
    } catch {
      toast('Error de conexión', 'error')
    }
    setCreating(false)
  }

  const reset = () => {
    setStep('input')
    setText('')
    setFields({})
    setImageData(null)
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div className="relative w-full max-w-md bg-white shadow-2xl flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-brand-pink/5 to-brand-orange/5 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="bg-brand-pink rounded-lg p-1.5">
              <Sparkles size={16} className="text-white" />
            </div>
            <div>
              <p className="font-semibold text-ink text-sm">Asistente IA</p>
              <p className="text-xs text-gray-500">Groq · {mode === 'image' ? 'llama-4-scout (visión)' : 'llama3-8b'}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Mode tabs — only shown during input step */}
        {step === 'input' && (
          <div className="flex border-b border-gray-100 shrink-0">
            <button
              onClick={() => setMode('text')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors ${
                mode === 'text'
                  ? 'text-brand-pink border-b-2 border-brand-pink'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Type size={13} /> Texto
            </button>
            <button
              onClick={() => setMode('image')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors ${
                mode === 'image'
                  ? 'text-brand-pink border-b-2 border-brand-pink'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <FileImage size={13} /> Imagen
            </button>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">

          {/* ── Texto: input ── */}
          {step === 'input' && mode === 'text' && (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-gray-700 mb-1">Pegá el texto del lead</p>
                <p className="text-xs text-gray-500 mb-3">
                  WhatsApp, mail, nota — la IA extrae nombre, teléfono, email, barrio y más.
                </p>
                <textarea
                  ref={textareaRef}
                  value={text}
                  onChange={e => setText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) extract() }}
                  placeholder={'Ej: "Hola, quiero vender mi depto en Palermo. Soy Marcos García, te dejo mi número: 11-5534-2210"'}
                  className="w-full h-48 border border-gray-200 rounded-xl p-3.5 text-sm resize-none focus:outline-none placeholder:text-gray-400"
                />
              </div>
              <div className="bg-gray-50 rounded-xl p-3.5 space-y-1.5">
                <p className="text-xs font-medium text-gray-600">Podés pegar:</p>
                <ul className="text-xs text-gray-500 space-y-1 list-disc list-inside">
                  <li>Conversación de WhatsApp</li>
                  <li>Mail de consulta del portal</li>
                  <li>Nota rápida con datos del cliente</li>
                </ul>
              </div>
            </div>
          )}

          {/* ── Imagen: input ── */}
          {step === 'input' && mode === 'image' && (
            <div className="space-y-4">
              {!imageData ? (
                <div className="flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-xl p-8 text-center space-y-3 bg-gray-50 min-h-[200px]">
                  <div className="bg-gray-100 rounded-full p-3">
                    <ClipboardPaste size={24} className="text-gray-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-700">Pegá una imagen</p>
                    <p className="text-xs text-gray-500 mt-1">
                      Usá <kbd className="bg-gray-200 rounded px-1 py-0.5 text-[10px] font-mono">Ctrl+V</kbd> para pegar desde el portapapeles
                    </p>
                  </div>
                  <p className="text-xs text-gray-400">
                    Screenshot de WhatsApp, mail, tarjeta de presentación, nota manuscrita
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm font-medium text-gray-700">Imagen lista para analizar</p>
                  <div className="relative rounded-xl overflow-hidden border border-gray-200">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={imageData.previewUrl}
                      alt="Imagen a analizar"
                      className="w-full max-h-64 object-contain bg-gray-50"
                    />
                  </div>
                  <button
                    onClick={() => setImageData(null)}
                    className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
                  >
                    <X size={12} /> Cambiar imagen
                  </button>
                </div>
              )}
              <div className="bg-blue-50 rounded-xl p-3.5 space-y-1">
                <p className="text-xs font-medium text-blue-700">Tip</p>
                <p className="text-xs text-blue-600">
                  Copiá cualquier screenshot y pegalo acá con Ctrl+V. También funciona desde la pestaña Texto.
                </p>
              </div>
            </div>
          )}

          {/* ── Review: campos extraídos ── */}
          {step === 'review' && (
            <div className="space-y-5">
              <div>
                <p className="text-sm font-medium text-gray-700 mb-0.5">Datos encontrados</p>
                <p className="text-xs text-gray-500">Revisá y editá antes de crear el lead.</p>
              </div>
              <div className="space-y-3">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Contacto</p>
                <Field icon={<User size={14} />} label="Nombre *" value={fields.full_name ?? ''} onChange={v => setFields(f => ({ ...f, full_name: v }))} placeholder="Nombre completo" />
                <Field icon={<Phone size={14} />} label="Teléfono" value={fields.phone ?? ''} onChange={v => setFields(f => ({ ...f, phone: v }))} placeholder="11-XXXX-XXXX" />
                <Field icon={<Mail size={14} />} label="Email" value={fields.email ?? ''} onChange={v => setFields(f => ({ ...f, email: v }))} placeholder="email@ejemplo.com" />
              </div>
              <div className="space-y-3">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Lead</p>
                <Field icon={<MapPin size={14} />} label="Barrio / Zona" value={fields.neighborhood ?? ''} onChange={v => setFields(f => ({ ...f, neighborhood: v }))} placeholder="Ej: Palermo, Belgrano" />
                <Field icon={<Home size={14} />} label="Tipo de propiedad" value={fields.property_type ?? ''} onChange={v => setFields(f => ({ ...f, property_type: v }))} placeholder="Ej: departamento, casa, ph" />
                <div>
                  <label className="text-xs text-gray-600 mb-1 flex items-center gap-1.5">
                    <span className="text-gray-400"><Home size={14} /></span>
                    Operación
                  </label>
                  <select
                    value={normalizeOperation(fields.operation)}
                    onChange={e => setFields(f => ({ ...f, operation: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none bg-white"
                  >
                    <option value="venta">Venta</option>
                    <option value="alquiler">Alquiler</option>
                    <option value="venta_alquiler">Venta o Alquiler</option>
                  </select>
                </div>
                <Field icon={<DollarSign size={14} />} label="Presupuesto" value={fields.budget ?? ''} onChange={v => setFields(f => ({ ...f, budget: v }))} placeholder="Ej: USD 150.000" />
                <div>
                  <label className="text-xs text-gray-600 mb-1 flex items-center gap-1.5">
                    <span className="text-gray-400"><FileText size={14} /></span>
                    Notas
                  </label>
                  <textarea
                    value={fields.notes ?? ''}
                    onChange={e => setFields(f => ({ ...f, notes: e.target.value }))}
                    rows={3}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none"
                    placeholder="Información adicional..."
                  />
                </div>
              </div>
            </div>
          )}

          {/* ── Done ── */}
          {step === 'done' && (
            <div className="flex flex-col items-center justify-center h-full py-16 text-center space-y-4">
              <div className="bg-green-100 rounded-full p-4">
                <CheckCircle size={32} className="text-green-600" />
              </div>
              <div>
                <p className="font-semibold text-ink">Lead creado</p>
                <p className="text-sm text-gray-500 mt-1">
                  {fields.full_name} fue agregado al pipeline de leads.
                </p>
              </div>
              <button
                onClick={reset}
                className="text-brand-pink text-sm font-medium hover:underline flex items-center gap-1.5 mt-2"
              >
                <Plus size={14} /> Crear otro lead
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-100 px-5 py-4 shrink-0">
          {step === 'input' && mode === 'text' && (
            <button
              onClick={extract}
              disabled={!text.trim() || loading}
              className="w-full bg-gradient-to-br from-brand-pink to-brand-orange text-white py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-40 hover:opacity-90 transition-colors"
            >
              {loading
                ? <><Loader2 size={16} className="animate-spin" /> Extrayendo datos...</>
                : <><Sparkles size={16} /> Extraer datos con IA</>}
            </button>
          )}

          {step === 'input' && mode === 'image' && (
            <button
              onClick={extractImage}
              disabled={!imageData || loading}
              className="w-full bg-gradient-to-br from-brand-pink to-brand-orange text-white py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-40 hover:opacity-90 transition-colors"
            >
              {loading
                ? <><Loader2 size={16} className="animate-spin" /> Analizando imagen...</>
                : <><Sparkles size={16} /> Analizar imagen con IA</>}
            </button>
          )}

          {step === 'review' && (
            <div className="space-y-2">
              <button
                onClick={createLead}
                disabled={creating || !fields.full_name?.trim()}
                className="w-full bg-gradient-to-br from-brand-pink to-brand-orange text-white py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-40 hover:opacity-90 transition-colors"
              >
                {creating
                  ? <><Loader2 size={16} className="animate-spin" /> Creando lead...</>
                  : <><Plus size={16} /> Crear lead</>}
              </button>
              <button
                onClick={() => setStep('input')}
                className="w-full text-gray-500 py-2 text-sm flex items-center justify-center gap-1.5 hover:text-gray-700 transition-colors"
              >
                <ArrowLeft size={14} /> Volver a editar
              </button>
            </div>
          )}

          {step === 'done' && (
            <button
              onClick={onClose}
              className="w-full border border-gray-200 text-gray-700 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              Cerrar
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
