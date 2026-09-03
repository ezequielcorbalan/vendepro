'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader2, Save, X, Upload, Image as ImageIcon, ClipboardPaste } from 'lucide-react'
import {
  type SoldProperty,
  PROPERTY_TYPES,
  createSoldProperty,
  updateSoldProperty,
  uploadPhotoToR2,
} from '@/lib/sold-properties/api'
import { useToast } from '@/components/ui/Toast'
import { Field, Input, Select, Textarea } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'

interface Props {
  initial?: Partial<SoldProperty> | null
  onCancel: () => void
  onSaved: (id: string) => void
}

export default function SoldPropertyForm({ initial, onCancel, onSaved }: Props) {
  const { toast } = useToast()
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [originType, setOriginType] = useState<'team' | 'external'>(
    initial?.external_agent_name ? 'external' : 'team',
  )
  const fileRef = useRef<HTMLInputElement>(null)
  const dropRef = useRef<HTMLFormElement>(null)

  const [form, setForm] = useState({
    property_type: initial?.property_type ?? 'departamento',
    neighborhood: initial?.neighborhood ?? '',
    address_approx: initial?.address_approx ?? '',
    covered_area: initial?.covered_area ?? '',
    total_area: initial?.total_area ?? '',
    semi_area: initial?.semi_area ?? '',
    rooms: initial?.rooms ?? '',
    bedrooms: initial?.bedrooms ?? '',
    bathrooms: initial?.bathrooms ?? '',
    parking: initial?.parking ?? '',
    listing_price_usd: initial?.listing_price_usd ?? '',
    closing_price_usd: initial?.closing_price_usd ?? '',
    closed_at: initial?.closed_at?.slice(0, 10) ?? '',
    notes: initial?.notes ?? '',
    agent_id: initial?.agent_id ?? null,
    external_agent_name: initial?.external_agent_name ?? '',
    external_agency: initial?.external_agency ?? '',
  })
  const [photos, setPhotos] = useState<string[]>(initial?.photos ?? [])

  function setField<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  // ── PASTE handler — captura imágenes desde el portapapeles ──────
  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      if (!e.clipboardData) return
      const files: File[] = []
      for (const item of Array.from(e.clipboardData.items)) {
        if (item.kind === 'file' && item.type.startsWith('image/')) {
          const f = item.getAsFile()
          if (f) files.push(f)
        }
      }
      if (files.length === 0) return
      e.preventDefault()
      uploadFiles(files)
    }
    const node = dropRef.current
    node?.addEventListener('paste', onPaste as any)
    return () => node?.removeEventListener('paste', onPaste as any)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function uploadFiles(files: File[]) {
    setUploading(true)
    const results: string[] = []
    for (const f of files) {
      try {
        const url = await uploadPhotoToR2(f)
        if (url) results.push(url)
      } catch {}
    }
    if (results.length > 0) setPhotos(prev => [...prev, ...results])
    setUploading(false)
  }

  function onPickFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (files.length > 0) uploadFiles(files)
    e.target.value = ''
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'))
    if (files.length > 0) uploadFiles(files)
  }

  function removePhoto(url: string) {
    setPhotos(prev => prev.filter(u => u !== url))
  }

  function num(v: any): number | null {
    if (v === '' || v === null || v === undefined) return null
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }
  function int(v: any): number | null {
    const n = num(v)
    return n === null ? null : Math.round(n)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (originType === 'external' && !form.external_agent_name.trim()) {
      toast('Indicá el nombre del colega externo', 'error')
      return
    }
    setSaving(true)
    const payload: any = {
      property_type: form.property_type,
      neighborhood: form.neighborhood || null,
      address_approx: form.address_approx || null,
      covered_area: num(form.covered_area),
      total_area: num(form.total_area),
      semi_area: num(form.semi_area),
      rooms: int(form.rooms),
      bedrooms: int(form.bedrooms),
      bathrooms: int(form.bathrooms),
      parking: int(form.parking),
      listing_price_usd: num(form.listing_price_usd),
      closing_price_usd: num(form.closing_price_usd),
      closed_at: form.closed_at || null,
      notes: form.notes || null,
      photos,
    }
    if (originType === 'team') {
      payload.agent_id = form.agent_id || null
      payload.external_agent_name = null
      payload.external_agency = null
    } else {
      payload.agent_id = null
      payload.external_agent_name = form.external_agent_name.trim()
      payload.external_agency = form.external_agency.trim() || null
    }

    try {
      if (initial?.id) {
        const ok = await updateSoldProperty(initial.id, payload)
        if (!ok) throw new Error()
        toast('Cambios guardados')
        onSaved(initial.id)
      } else {
        const r = await createSoldProperty(payload)
        if (!r?.id) throw new Error()
        toast('Cierre real cargado')
        onSaved(r.id)
      }
    } catch {
      toast('Error guardando', 'error')
    }
    setSaving(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" ref={dropRef} tabIndex={-1}>
      {/* Origen */}
      <div className="flex gap-2 text-xs">
        <button
          type="button"
          onClick={() => setOriginType('team')}
          className={`px-3 py-1.5 rounded-control font-medium ${
            originType === 'team' ? 'bg-brand-pink/10 text-brand-pink' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Del equipo
        </button>
        <button
          type="button"
          onClick={() => setOriginType('external')}
          className={`px-3 py-1.5 rounded-control font-medium ${
            originType === 'external' ? 'bg-brand-pink/10 text-brand-pink' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Colega externo
        </button>
      </div>

      {originType === 'external' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Nombre del colega *">
            <Input
              required
              value={form.external_agent_name}
              onChange={e => setField('external_agent_name', e.target.value)}
              placeholder="Juan Pérez"
            />
          </Field>
          <Field label="Inmobiliaria">
            <Input
              value={form.external_agency}
              onChange={e => setField('external_agency', e.target.value)}
              placeholder="ej. Tizado / Reynolds"
            />
          </Field>
        </div>
      )}

      {/* Identificación */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Field label="Tipo *">
          <Select value={form.property_type} onChange={e => setField('property_type', e.target.value as any)}>
            {PROPERTY_TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </Select>
        </Field>
        <Field label="Barrio">
          <Input value={form.neighborhood} onChange={e => setField('neighborhood', e.target.value)} placeholder="Palermo" />
        </Field>
        <Field label="Dirección aproximada">
          <Input value={form.address_approx} onChange={e => setField('address_approx', e.target.value)} placeholder="Ladines al 2400" />
        </Field>
      </div>

      {/* Áreas */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Field label="Sup. cubierta (m²)">
          <Input type="number" step="0.1" value={form.covered_area as any} onChange={e => setField('covered_area', e.target.value as any)} />
        </Field>
        <Field label="Sup. total (m²)">
          <Input type="number" step="0.1" value={form.total_area as any} onChange={e => setField('total_area', e.target.value as any)} />
        </Field>
        <Field label="Semicub. (m²)">
          <Input type="number" step="0.1" value={form.semi_area as any} onChange={e => setField('semi_area', e.target.value as any)} />
        </Field>
        <Field label="Cocheras">
          <Input type="number" step="1" value={form.parking as any} onChange={e => setField('parking', e.target.value as any)} />
        </Field>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Field label="Ambientes">
          <Input type="number" step="1" value={form.rooms as any} onChange={e => setField('rooms', e.target.value as any)} />
        </Field>
        <Field label="Dormitorios">
          <Input type="number" step="1" value={form.bedrooms as any} onChange={e => setField('bedrooms', e.target.value as any)} />
        </Field>
        <Field label="Baños">
          <Input type="number" step="1" value={form.bathrooms as any} onChange={e => setField('bathrooms', e.target.value as any)} />
        </Field>
      </div>

      {/* Precios y fecha */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Field label="Precio publicación (USD)">
          <Input type="number" step="100" value={form.listing_price_usd as any} onChange={e => setField('listing_price_usd', e.target.value as any)} placeholder="180000" />
        </Field>
        <Field label="Precio de cierre (USD) *">
          <Input type="number" step="100" required value={form.closing_price_usd as any} onChange={e => setField('closing_price_usd', e.target.value as any)} placeholder="170000" />
        </Field>
        <Field label="Fecha de cierre">
          <Input type="date" value={form.closed_at} onChange={e => setField('closed_at', e.target.value)} />
        </Field>
      </div>

      {/* Notas */}
      <Field label="Notas internas">
        <Textarea
          rows={2}
          value={form.notes}
          onChange={e => setField('notes', e.target.value)}
          placeholder="ej. vendió rápido por mudanza, contraoferta del 8%, etc."
        />
      </Field>

      {/* Fotos */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Fotos (8 ideales)</label>
        <div
          onDragOver={e => e.preventDefault()}
          onDrop={onDrop}
          className="border-2 border-dashed border-gray-200 rounded-card p-3 hover:border-brand-pink/40 transition-colors"
        >
          {photos.length === 0 ? (
            <div className="text-center py-6 text-xs text-gray-500">
              <ImageIcon className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              Arrastrá imágenes acá, pegá una captura (Ctrl+V) o subí desde tu equipo.
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-2">
              {photos.map(url => (
                <div key={url} className="relative group aspect-square bg-gray-100 rounded-control overflow-hidden">
                  <img src={url} alt="" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removePhoto(url)}
                    className="absolute top-1 right-1 bg-white/90 rounded-full p-0.5 opacity-0 group-hover:opacity-100 hover:bg-red-50"
                  >
                    <X className="w-3 h-3 text-gray-600" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="flex items-center gap-2 mt-2">
            <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()} icon={<Upload className="w-3.5 h-3.5" />}>
              Subir
            </Button>
            <span className="text-[10px] text-gray-400 flex items-center gap-1">
              <ClipboardPaste className="w-3 h-3" /> o pegá con Ctrl+V
            </span>
            {uploading && (
              <span className="text-[10px] text-gray-500 flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" /> subiendo…
              </span>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={onPickFiles}
          />
        </div>
      </div>

      {/* Acciones */}
      <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
        <Button type="button" variant="ghost" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" loading={saving} icon={<Save className="w-4 h-4" />}>
          {initial?.id ? 'Guardar cambios' : 'Cargar cierre'}
        </Button>
      </div>
    </form>
  )
}
