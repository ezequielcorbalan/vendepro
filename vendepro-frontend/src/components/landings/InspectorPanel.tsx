'use client'
import type { Block, HeroData, HeroSplitData, LeadFormData, FeaturesGridData, AmenitiesChipsData, GalleryData, BenefitsListData, FooterData } from '@/lib/landings/types'
import { BLOCK_LABELS } from './blocks'
import ImageUpload from './ImageUpload'

interface Props {
  block: Block
  onChange: (patch: any) => void
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs uppercase tracking-wider font-semibold text-gray-500">{label}</label>
      {children}
    </div>
  )
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#ff007c]" />
}

function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#ff007c] min-h-[60px] resize-y" />
}

export default function InspectorPanel({ block, onChange }: Props) {
  return (
    <div className="p-4 space-y-4">
      <div>
        <p className="text-xs uppercase tracking-wider font-semibold text-[#ff007c]">Block · {block.type}</p>
        <p className="text-sm text-gray-900 font-medium">{BLOCK_LABELS[block.type]}</p>
      </div>

      {block.type === 'hero' && <HeroFields data={block.data as HeroData} onChange={onChange} />}
      {block.type === 'hero-split' && <HeroSplitFields data={block.data as HeroSplitData} onChange={onChange} />}
      {block.type === 'features-grid' && <FeaturesFields data={block.data as FeaturesGridData} onChange={onChange} />}
      {block.type === 'amenities-chips' && <AmenitiesFields data={block.data as AmenitiesChipsData} onChange={onChange} />}
      {block.type === 'gallery' && <GalleryFields data={block.data as GalleryData} onChange={onChange} />}
      {block.type === 'benefits-list' && <BenefitsFields data={block.data as BenefitsListData} onChange={onChange} />}
      {block.type === 'lead-form' && <LeadFormFields data={block.data as LeadFormData} onChange={onChange} />}
      {block.type === 'footer' && <FooterFields data={block.data as FooterData} onChange={onChange} />}
    </div>
  )
}

function HeroFields({ data, onChange }: { data: HeroData; onChange: (p: Partial<HeroData>) => void }) {
  return (
    <>
      <Field label="Eyebrow (opcional)"><TextInput value={data.eyebrow ?? ''} onChange={e => onChange({ eyebrow: e.target.value })} /></Field>
      <Field label="Título"><TextArea value={data.title} onChange={e => onChange({ title: e.target.value })} /></Field>
      <Field label="Subtítulo"><TextArea value={data.subtitle ?? ''} onChange={e => onChange({ subtitle: e.target.value })} /></Field>
      <Field label="Imagen de fondo">
        <ImageUpload value={data.background_image_url} onChange={(url) => onChange({ background_image_url: url })} />
      </Field>
      <Field label="Overlay opacity (0 a 1)"><TextInput type="number" min={0} max={1} step={0.1} value={data.overlay_opacity} onChange={e => onChange({ overlay_opacity: parseFloat(e.target.value) })} /></Field>
      <Field label="CTA Label"><TextInput value={data.cta?.label ?? ''} onChange={e => onChange({ cta: { ...(data.cta ?? { href: '#form' }), label: e.target.value } })} /></Field>
      <Field label="CTA href"><TextInput value={data.cta?.href ?? ''} onChange={e => onChange({ cta: { ...(data.cta ?? { label: 'Acción' }), href: e.target.value } })} /></Field>
    </>
  )
}

function HeroSplitFields({ data, onChange }: { data: HeroSplitData; onChange: (p: Partial<HeroSplitData>) => void }) {
  return (
    <>
      <Field label="Título"><TextArea value={data.title} onChange={e => onChange({ title: e.target.value })} /></Field>
      <Field label="Subtítulo"><TextArea value={data.subtitle ?? ''} onChange={e => onChange({ subtitle: e.target.value })} /></Field>
      <Field label="Imagen"><ImageUpload value={data.media_url} onChange={(url) => onChange({ media_url: url })} /></Field>
      <Field label="Lado de la imagen">
        <select value={data.media_side} onChange={e => onChange({ media_side: e.target.value as 'left' | 'right' })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
          <option value="left">Izquierda</option>
          <option value="right">Derecha</option>
        </select>
      </Field>
      <Field label="Acento">
        <select value={data.accent_color} onChange={e => onChange({ accent_color: e.target.value as 'pink' | 'orange' | 'dark' })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
          <option value="pink">Rosa</option>
          <option value="orange">Naranja</option>
          <option value="dark">Oscuro</option>
        </select>
      </Field>
    </>
  )
}

function FeaturesFields({ data, onChange }: { data: FeaturesGridData; onChange: (p: Partial<FeaturesGridData>) => void }) {
  const updateItem = (idx: number, patch: Partial<FeaturesGridData['items'][0]>) => {
    const items = data.items.map((it, i) => i === idx ? { ...it, ...patch } : it)
    onChange({ items })
  }
  return (
    <>
      <Field label="Título"><TextInput value={data.title ?? ''} onChange={e => onChange({ title: e.target.value })} /></Field>
      <Field label="Columnas">
        <select value={data.columns} onChange={e => onChange({ columns: Number(e.target.value) as 3 | 4 })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
          <option value={3}>3</option><option value={4}>4</option>
        </select>
      </Field>
      <div className="space-y-3">
        {data.items.map((it, i) => (
          <div key={i} className="border border-gray-200 rounded-lg p-3 space-y-2 bg-gray-50">
            <TextInput placeholder="Ícono (nombre de lucide, ej: Star)" value={it.icon} onChange={e => updateItem(i, { icon: e.target.value })} />
            <TextInput placeholder="Título" value={it.title} onChange={e => updateItem(i, { title: e.target.value })} />
            <TextArea placeholder="Texto" value={it.text} onChange={e => updateItem(i, { text: e.target.value })} />
          </div>
        ))}
      </div>
    </>
  )
}

function AmenitiesFields({ data, onChange }: { data: AmenitiesChipsData; onChange: (p: Partial<AmenitiesChipsData>) => void }) {
  return (
    <>
      <Field label="Título"><TextInput value={data.title ?? ''} onChange={e => onChange({ title: e.target.value })} /></Field>
      <div className="space-y-2">
        {data.chips.map((c, i) => (
          <div key={i} className="flex gap-2">
            <TextInput className="!w-16" value={c.emoji ?? ''} placeholder="🏊" onChange={e => { const chips = [...data.chips]; chips[i] = { ...c, emoji: e.target.value }; onChange({ chips }) }} />
            <TextInput value={c.label} onChange={e => { const chips = [...data.chips]; chips[i] = { ...c, label: e.target.value }; onChange({ chips }) }} />
          </div>
        ))}
      </div>
    </>
  )
}

function GalleryFields({ data, onChange }: { data: GalleryData; onChange: (p: Partial<GalleryData>) => void }) {
  return (
    <>
      <Field label="Layout">
        <select value={data.layout} onChange={e => onChange({ layout: e.target.value as GalleryData['layout'] })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
          <option value="grid">Grid</option>
          <option value="mosaic">Mosaico</option>
          <option value="carousel">Carrusel</option>
        </select>
      </Field>
      <Field label="Imágenes">
        <div className="space-y-2">
          {data.images.map((img, i) => (
            <div key={i} className="flex gap-2 items-center">
              <img src={img.url} alt="" className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
              <button onClick={() => onChange({ images: data.images.filter((_, j) => j !== i) })} className="text-xs text-red-500 hover:underline">Quitar</button>
            </div>
          ))}
          <ImageUpload value="" allowPropertyPicker onChange={(url, source, property_id) => onChange({ images: [...data.images, { url, source: source ?? 'upload', property_id }] })} />
        </div>
      </Field>
    </>
  )
}

function BenefitsFields({ data, onChange }: { data: BenefitsListData; onChange: (p: Partial<BenefitsListData>) => void }) {
  return (
    <>
      <Field label="Título"><TextInput value={data.title ?? ''} onChange={e => onChange({ title: e.target.value })} /></Field>
      <div className="space-y-3">
        {data.items.map((it, i) => (
          <div key={i} className="border border-gray-200 rounded-lg p-3 space-y-2 bg-gray-50">
            <TextInput placeholder="Título del beneficio" value={it.title} onChange={e => { const items = [...data.items]; items[i] = { ...it, title: e.target.value }; onChange({ items }) }} />
            <TextArea placeholder="Descripción" value={it.description ?? ''} onChange={e => { const items = [...data.items]; items[i] = { ...it, description: e.target.value }; onChange({ items }) }} />
          </div>
        ))}
      </div>
    </>
  )
}

function LeadFormFields({ data, onChange }: { data: LeadFormData; onChange: (p: Partial<LeadFormData>) => void }) {
  return (
    <>
      <Field label="Título"><TextArea value={data.title} onChange={e => onChange({ title: e.target.value })} /></Field>
      <Field label="Subtítulo"><TextArea value={data.subtitle ?? ''} onChange={e => onChange({ subtitle: e.target.value })} /></Field>
      <Field label="Label del botón"><TextInput value={data.submit_label} onChange={e => onChange({ submit_label: e.target.value })} /></Field>
      <Field label="Mensaje de éxito"><TextArea value={data.success_message} onChange={e => onChange({ success_message: e.target.value })} /></Field>
      <Field label="Nota de privacidad"><TextArea value={data.privacy_note ?? ''} onChange={e => onChange({ privacy_note: e.target.value })} /></Field>
      <p className="text-xs text-gray-500">Los campos `name` y `phone` son obligatorios y no se pueden quitar.</p>
    </>
  )
}

function FooterFields({ data, onChange }: { data: FooterData; onChange: (p: Partial<FooterData>) => void }) {
  return (
    <>
      <Field label="Nombre inmobiliaria"><TextInput value={data.agency_name ?? ''} onChange={e => onChange({ agency_name: e.target.value })} /></Field>
      <Field label="Matrícula"><TextInput value={data.agency_registration ?? ''} onChange={e => onChange({ agency_registration: e.target.value })} /></Field>
      <Field label="Teléfono"><TextInput value={data.phone ?? ''} onChange={e => onChange({ phone: e.target.value })} /></Field>
      <Field label="Email"><TextInput type="email" value={data.email ?? ''} onChange={e => onChange({ email: e.target.value })} /></Field>
      <Field label="WhatsApp"><TextInput value={data.whatsapp ?? ''} onChange={e => onChange({ whatsapp: e.target.value })} /></Field>
      <Field label="Instagram"><TextInput value={data.instagram ?? ''} onChange={e => onChange({ instagram: e.target.value })} /></Field>
      <Field label="Disclaimer"><TextArea value={data.disclaimer ?? ''} onChange={e => onChange({ disclaimer: e.target.value })} /></Field>
    </>
  )
}
