'use client'

import { useState, useEffect, useRef } from 'react'
import {
  X, Sparkles, Loader2, CheckCircle, User, Phone, Mail,
  MapPin, DollarSign, Home, FileText, ArrowLeft, Plus,
} from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'

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
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff007c]/20 focus:border-[#ff007c]/40 placeholder:text-gray-400"
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
  const [step, setStep] = useState<'input' | 'review' | 'done'>('input')
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [fields, setFields] = useState<ExtractedFields>({})
  const [creating, setCreating] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

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
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-full max-w-md bg-white shadow-2xl flex flex-col h-full overflow-hidden animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-[#ff007c]/5 to-[#ff8017]/5 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="bg-[#ff007c] rounded-lg p-1.5">
              <Sparkles size={16} className="text-white" />
            </div>
            <div>
              <p className="font-semibold text-gray-900 text-sm">Asistente IA</p>
              <p className="text-xs text-gray-500">Groq · llama3-8b</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {/* ── Step 1: paste text ── */}
          {step === 'input' && (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-gray-700 mb-1">Pegá el texto del lead</p>
                <p className="text-xs text-gray-500 mb-3">
                  WhatsApp, mail, nota manuscrita, formulario — la IA extrae nombre, teléfono, email, barrio y más.
                </p>
                <textarea
                  ref={textareaRef}
                  value={text}
                  onChange={e => setText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) extract() }}
                  placeholder={'Ej: "Hola, quiero vender mi depto en Palermo. Soy Marcos García, te dejo mi número: 11-5534-2210"'}
                  className="w-full h-48 border border-gray-200 rounded-xl p-3.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#ff007c]/20 focus:border-[#ff007c]/40 placeholder:text-gray-400"
                />
              </div>
              <div className="bg-gray-50 rounded-xl p-3.5 space-y-2">
                <p className="text-xs font-medium text-gray-600">Podés pegar:</p>
                <ul className="text-xs text-gray-500 space-y-1 list-disc list-inside">
                  <li>Conversación de WhatsApp</li>
                  <li>Mail de consulta del portal</li>
                  <li>Nota rápida con datos del cliente</li>
                  <li>Texto de un formulario web</li>
                </ul>
              </div>
            </div>
          )}

          {/* ── Step 2: review extracted fields ── */}
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
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff007c]/20 bg-white"
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
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#ff007c]/20"
                    placeholder="Información adicional..."
                  />
                </div>
              </div>
            </div>
          )}

          {/* ── Step 3: done ── */}
          {step === 'done' && (
            <div className="flex flex-col items-center justify-center h-full py-16 text-center space-y-4">
              <div className="bg-green-100 rounded-full p-4">
                <CheckCircle size={32} className="text-green-600" />
              </div>
              <div>
                <p className="font-semibold text-gray-900">Lead creado</p>
                <p className="text-sm text-gray-500 mt-1">
                  {fields.full_name} fue agregado al pipeline de leads.
                </p>
              </div>
              <button
                onClick={reset}
                className="text-[#ff007c] text-sm font-medium hover:underline flex items-center gap-1.5 mt-2"
              >
                <Plus size={14} /> Crear otro lead
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-100 px-5 py-4 shrink-0">
          {step === 'input' && (
            <button
              onClick={extract}
              disabled={!text.trim() || loading}
              className="w-full bg-[#ff007c] text-white py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-40 hover:bg-[#e0006e] transition-colors"
            >
              {loading
                ? <><Loader2 size={16} className="animate-spin" /> Extrayendo datos...</>
                : <><Sparkles size={16} /> Extraer datos con IA</>}
            </button>
          )}

          {step === 'review' && (
            <div className="space-y-2">
              <button
                onClick={createLead}
                disabled={creating || !fields.full_name?.trim()}
                className="w-full bg-[#ff007c] text-white py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-40 hover:bg-[#e0006e] transition-colors"
              >
                {creating
                  ? <><Loader2 size={16} className="animate-spin" /> Creando lead...</>
                  : <><Plus size={16} /> Crear lead</>}
              </button>
              <button
                onClick={() => setStep('input')}
                className="w-full text-gray-500 py-2 text-sm flex items-center justify-center gap-1.5 hover:text-gray-700 transition-colors"
              >
                <ArrowLeft size={14} /> Volver a editar texto
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
