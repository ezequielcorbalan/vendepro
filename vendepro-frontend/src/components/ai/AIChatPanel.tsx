'use client'

import { useState, useEffect, useRef } from 'react'
import {
  X, Sparkles, Loader2, CheckCircle, User, Phone, Mail,
  MapPin, DollarSign, Home, FileText, ArrowLeft, Plus,
  Type, FileImage, ClipboardPaste,
} from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { Input as DSInput, Select as DSSelect, Textarea as DSTextarea } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Drawer } from '@/components/ui/Drawer'
import { Tabs } from '@/components/ui/Tabs'

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
      <DSInput
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
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
    <Drawer
      open
      onClose={() => onClose?.()}
      width="w-full max-w-md"
      padded={false}
      /* El header propio: medallón + nombre + modelo. El ícono usa el token
         `bg-brand-gradient`, el MISMO que el botón flotante que abre el panel,
         así el objeto se reconoce como el mismo abierto y cerrado. */
      header={
        <div className="flex items-center gap-2.5">
          <div className="bg-brand-gradient rounded-full p-1.5 text-white">
            <Sparkles size={16} />
          </div>
          <div>
            <p className="font-semibold text-ink text-sm">Asistente IA</p>
            {/* Los nombres siguen a GROQ_MODELS en infrastructure/src/services/groq-ai-service.ts. */}
            <p className="text-xs text-gray-500">Groq · {mode === 'image' ? 'qwen3.8 (visión)' : 'compound-mini'}</p>
          </div>
        </div>
      }
    >
        {/* Elegir entre texto e imagen es navegación entre vistas del paso, así
            que son `Tabs` del DS y no dos botones con un borde inferior a mano. */}
        {step === 'input' && (
          <Tabs
            value={mode}
            onChange={v => setMode(v as 'text' | 'image')}
            items={[
              { value: 'text', label: 'Texto', icon: <Type size={13} /> },
              { value: 'image', label: 'Imagen', icon: <FileImage size={13} /> },
            ]}
          />
        )}

        <div className="p-5">

          {/* ── Texto: input ── */}
          {step === 'input' && mode === 'text' && (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-gray-700 mb-1">Pegá el texto del lead</p>
                <p className="text-xs text-gray-500 mb-3">
                  WhatsApp, mail, nota — la IA extrae nombre, teléfono, email, barrio y más.
                </p>
                {/* Textarea del DS: el de antes traía `focus:outline-none`, o sea
                    que se comía el anillo de foco del teclado. */}
                <DSTextarea
                  ref={textareaRef}
                  value={text}
                  onChange={e => setText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) extract() }}
                  placeholder={'Ej: "Hola, quiero vender mi depto en Palermo. Soy Marcos García, te dejo mi número: 11-5534-2210"'}
                  className="h-48 resize-none"
                />
              </div>
              <div className="bg-gray-50 rounded-card p-3.5 space-y-1.5">
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
                <div className="flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-card p-8 text-center space-y-3 bg-gray-50 min-h-[200px]">
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
                  <div className="relative rounded-card overflow-hidden border border-gray-200">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={imageData.previewUrl}
                      alt="Imagen a analizar"
                      className="w-full max-h-64 object-contain bg-gray-50"
                    />
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setImageData(null)} icon={<X size={12} />}>
                    Cambiar imagen
                  </Button>
                </div>
              )}
              <div className="bg-blue-50 rounded-card p-3.5 space-y-1">
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
                  <DSSelect
                    value={normalizeOperation(fields.operation)}
                    onChange={e => setFields(f => ({ ...f, operation: e.target.value }))}
                  >
                    <option value="venta">Venta</option>
                    <option value="alquiler">Alquiler</option>
                    <option value="venta_alquiler">Venta o Alquiler</option>
                  </DSSelect>
                </div>
                <Field icon={<DollarSign size={14} />} label="Presupuesto" value={fields.budget ?? ''} onChange={v => setFields(f => ({ ...f, budget: v }))} placeholder="Ej: USD 150.000" />
                <div>
                  <label className="text-xs text-gray-600 mb-1 flex items-center gap-1.5">
                    <span className="text-gray-400"><FileText size={14} /></span>
                    Notas
                  </label>
                  <DSTextarea
                    value={fields.notes ?? ''}
                    onChange={e => setFields(f => ({ ...f, notes: e.target.value }))}
                    rows={3}
                    className="resize-none"
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
              <Button variant="ghost" size="sm" onClick={reset} icon={<Plus size={14} />} className="mt-2">
                Crear otro lead
              </Button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-100 px-5 py-4 shrink-0">
          {step === 'input' && mode === 'text' && (
            <Button onClick={extract} disabled={!text.trim()} loading={loading} fullWidth icon={<Sparkles size={16} />}>
              {loading ? 'Extrayendo datos...' : 'Extraer datos con IA'}
            </Button>
          )}

          {step === 'input' && mode === 'image' && (
            <Button onClick={extractImage} disabled={!imageData} loading={loading} fullWidth icon={<Sparkles size={16} />}>
              {loading ? 'Analizando imagen...' : 'Analizar imagen con IA'}
            </Button>
          )}

          {step === 'review' && (
            <div className="space-y-2">
              <Button onClick={createLead} disabled={!fields.full_name?.trim()} loading={creating} fullWidth icon={<Plus size={16} />}>
                Crear lead
              </Button>
              <Button variant="ghost" onClick={() => setStep('input')} fullWidth icon={<ArrowLeft size={14} />}>
                Volver a editar
              </Button>
            </div>
          )}

          {step === 'done' && (
            <Button variant="outline" onClick={onClose} fullWidth>
              Cerrar
            </Button>
          )}
        </div>
    </Drawer>
  )
}
