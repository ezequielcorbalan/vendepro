'use client'
import Link from 'next/link'
import type { Block, HeroData, HeroSplitData, LeadFormData, FeaturesGridData, AmenitiesChipsData, GalleryData, BenefitsListData, FooterData, AgentHeroData, AgentHeroCta, AgentCredentialsData, CtaWhatsappData } from '@/lib/landings/types'
import { isBoundField } from '@/lib/landings/agent-bindings'
import { BLOCK_LABELS } from './blocks'
import ImageUpload from './ImageUpload'
import { Input, Textarea, Select } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Text } from '@/components/ui/Typography'

interface Props {
  block: Block
  onChange: (patch: any) => void
  onBlockChange?: (patch: Partial<Pick<Block, 'is_variable' | 'visible'>>) => void
}

/** Aviso que reemplaza la edición de un campo bindeado al perfil del agente (ver `lib/landings/agent-bindings.ts`). */
function BoundNotice() {
  return (
    <Text size="xs" tone="muted">
      Se sincroniza con tu perfil público.{' '}
      <Link href="/perfil" className="text-primary hover:underline">Editalo en Perfil.</Link>
    </Text>
  )
}

function Field({ label, children, bound }: { label: string; children: React.ReactNode; bound?: boolean }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs uppercase tracking-wider font-semibold text-gray-500">{label}</label>
      {children}
      {bound && <BoundNotice />}
    </div>
  )
}

// `TextInput`/`TextArea` eran wrappers locales que duplicaban los controles del
// design system. Se mantienen los nombres para no tocar los ~20 usos de abajo,
// pero ahora son los del DS.
const TextInput = Input
const TextArea = Textarea

export default function InspectorPanel({ block, onChange, onBlockChange }: Props) {
  const isVariable = block.is_variable === true
  return (
    <div className="p-4 space-y-4">
      <div>
        <Text size="xs" tone="primary" weight="semibold" className="uppercase tracking-wider">Block · {block.type}</Text>
        <p className="text-sm text-ink font-medium">{BLOCK_LABELS[block.type]}</p>
      </div>

      {onBlockChange && (
        <label className="flex items-start gap-2.5 p-3 rounded-control border border-gray-200 bg-gray-50 cursor-pointer hover:border-primary/40 transition-colors">
          <input
            type="checkbox"
            className="mt-0.5 w-4 h-4 accent-primary cursor-pointer"
            checked={isVariable}
            onChange={(e) => onBlockChange({ is_variable: e.target.checked })}
          />
          <span className="flex-1">
            <span className="block text-sm font-medium text-ink">Variable por tasación</span>
            <span className="block text-xs text-gray-500 mt-0.5">
              Este bloque se podrá editar al crear cada tasación. Si está desmarcado, el contenido es fijo y se hereda de esta plantilla.
            </span>
          </span>
        </label>
      )}

      {block.type === 'hero' && <HeroFields data={block.data as HeroData} onChange={onChange} />}
      {block.type === 'hero-split' && <HeroSplitFields data={block.data as HeroSplitData} onChange={onChange} />}
      {block.type === 'features-grid' && <FeaturesFields data={block.data as FeaturesGridData} onChange={onChange} />}
      {block.type === 'amenities-chips' && <AmenitiesFields data={block.data as AmenitiesChipsData} onChange={onChange} />}
      {block.type === 'gallery' && <GalleryFields data={block.data as GalleryData} onChange={onChange} />}
      {block.type === 'benefits-list' && <BenefitsFields data={block.data as BenefitsListData} onChange={onChange} />}
      {block.type === 'lead-form' && <LeadFormFields data={block.data as LeadFormData} onChange={onChange} />}
      {block.type === 'footer' && <FooterFields data={block.data as FooterData} onChange={onChange} binding={block.binding} />}
      {block.type === 'agent-hero' && <AgentHeroFields data={block.data as AgentHeroData} onChange={onChange} binding={block.binding} />}
      {block.type === 'agent-credentials' && <AgentCredentialsFields data={block.data as AgentCredentialsData} onChange={onChange} binding={block.binding} />}
      {block.type === 'cta-whatsapp' && <CtaWhatsappFields data={block.data as CtaWhatsappData} onChange={onChange} binding={block.binding} />}
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
        <Select value={data.media_side} onChange={e => onChange({ media_side: e.target.value as 'left' | 'right' })}>
          <option value="left">Izquierda</option>
          <option value="right">Derecha</option>
        </Select>
      </Field>
      <Field label="Acento">
        <Select value={data.accent_color} onChange={e => onChange({ accent_color: e.target.value as 'pink' | 'orange' | 'dark' })}>
          <option value="pink">Rosa</option>
          <option value="orange">Naranja</option>
          <option value="dark">Oscuro</option>
        </Select>
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
        <Select value={data.columns} onChange={e => onChange({ columns: Number(e.target.value) as 3 | 4 })}>
          <option value={3}>3</option><option value={4}>4</option>
        </Select>
      </Field>
      <div className="space-y-3">
        {data.items.map((it, i) => (
          <div key={i} className="border border-gray-200 rounded-control p-3 space-y-2 bg-gray-50">
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
        <Select value={data.layout} onChange={e => onChange({ layout: e.target.value as GalleryData['layout'] })}>
          <option value="grid">Grid</option>
          <option value="mosaic">Mosaico</option>
          <option value="carousel">Carrusel</option>
        </Select>
      </Field>
      <Field label="Imágenes">
        <div className="space-y-2">
          {data.images.map((img, i) => (
            <div key={i} className="flex gap-2 items-center">
              <img src={img.url} alt="" className="w-12 h-12 rounded-control object-cover flex-shrink-0" />
              <Button variant="ghost" size="sm" onClick={() => onChange({ images: data.images.filter((_, j) => j !== i) })} className="text-xs text-danger px-0">Quitar</Button>
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
          <div key={i} className="border border-gray-200 rounded-control p-3 space-y-2 bg-gray-50">
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

function FooterFields({ data, onChange, binding }: { data: FooterData; onChange: (p: Partial<FooterData>) => void; binding?: Block['binding'] }) {
  const bPhone = isBoundField('footer', 'phone', binding)
  const bInstagram = isBoundField('footer', 'instagram', binding)
  const bRegistration = isBoundField('footer', 'agency_registration', binding)
  return (
    <>
      <Field label="Nombre inmobiliaria"><TextInput value={data.agency_name ?? ''} onChange={e => onChange({ agency_name: e.target.value })} /></Field>
      <Field label="Matrícula" bound={bRegistration}><TextInput value={data.agency_registration ?? ''} disabled={bRegistration} onChange={e => onChange({ agency_registration: e.target.value })} /></Field>
      <Field label="Teléfono" bound={bPhone}><TextInput value={data.phone ?? ''} disabled={bPhone} onChange={e => onChange({ phone: e.target.value })} /></Field>
      <Field label="Email"><TextInput type="email" value={data.email ?? ''} onChange={e => onChange({ email: e.target.value })} /></Field>
      <Field label="WhatsApp"><TextInput value={data.whatsapp ?? ''} onChange={e => onChange({ whatsapp: e.target.value })} /></Field>
      <Field label="Instagram" bound={bInstagram}><TextInput value={data.instagram ?? ''} disabled={bInstagram} onChange={e => onChange({ instagram: e.target.value })} /></Field>
      <Field label="Disclaimer"><TextArea value={data.disclaimer ?? ''} onChange={e => onChange({ disclaimer: e.target.value })} /></Field>
    </>
  )
}

function AgentHeroFields({ data, onChange, binding }: { data: AgentHeroData; onChange: (p: Partial<AgentHeroData>) => void; binding?: Block['binding'] }) {
  const bName = isBoundField('agent-hero', 'name', binding)
  const bHeadline = isBoundField('agent-hero', 'headline', binding)
  const bBio = isBoundField('agent-hero', 'bio', binding)
  const bPhoto = isBoundField('agent-hero', 'photo_url', binding)
  const bBackground = isBoundField('agent-hero', 'background_image_url', binding)

  const updateCta = (idx: number, patch: Partial<AgentHeroCta>) => {
    const ctas = data.ctas.map((c, i) => i === idx ? { ...c, ...patch } : c)
    onChange({ ctas })
  }

  return (
    <>
      <Field label="Nombre" bound={bName}><TextInput value={data.name} disabled={bName} onChange={e => onChange({ name: e.target.value })} /></Field>
      <Field label="Headline" bound={bHeadline}><TextInput value={data.headline ?? ''} disabled={bHeadline} onChange={e => onChange({ headline: e.target.value })} /></Field>
      <Field label="Bio" bound={bBio}><TextArea value={data.bio ?? ''} disabled={bBio} onChange={e => onChange({ bio: e.target.value })} /></Field>
      <Field label="Foto" bound={bPhoto}>
        {bPhoto ? (
          <div className="flex items-center gap-2">
            {data.photo_url && <img src={data.photo_url} alt="" className="w-12 h-12 rounded-full object-cover" />}
          </div>
        ) : (
          <ImageUpload value={data.photo_url} onChange={(url) => onChange({ photo_url: url })} />
        )}
      </Field>
      <Field label="Imagen de fondo (opcional)" bound={bBackground}>
        {bBackground ? (
          data.background_image_url ? <img src={data.background_image_url} alt="" className="w-full h-16 rounded-control object-cover" /> : null
        ) : (
          <ImageUpload value={data.background_image_url ?? ''} onChange={(url) => onChange({ background_image_url: url })} />
        )}
      </Field>
      <Field label="Color de acento">
        <Select value={data.accent_color} onChange={e => onChange({ accent_color: e.target.value as AgentHeroData['accent_color'] })}>
          <option value="pink">Rosa</option>
          <option value="orange">Naranja</option>
          <option value="dark">Oscuro</option>
        </Select>
      </Field>
      <Field label="CTAs">
        <div className="space-y-2">
          {data.ctas.map((cta, i) => (
            <div key={i} className="border border-gray-200 rounded-control p-3 space-y-2 bg-gray-50">
              <TextInput placeholder="Label" value={cta.label} onChange={e => updateCta(i, { label: e.target.value })} />
              <TextInput placeholder="Link (URL, #ancla o teléfono si es WhatsApp)" value={cta.href} onChange={e => updateCta(i, { href: e.target.value })} />
              <Select value={cta.style} onChange={e => updateCta(i, { style: e.target.value as AgentHeroCta['style'] })}>
                <option value="primary">Primario</option>
                <option value="secondary">Secundario</option>
                <option value="whatsapp">WhatsApp</option>
              </Select>
              <Button variant="ghost" size="sm" onClick={() => onChange({ ctas: data.ctas.filter((_, j) => j !== i) })} className="text-xs text-danger px-0">Quitar</Button>
            </div>
          ))}
          <Button variant="ghost" size="sm" onClick={() => onChange({ ctas: [...data.ctas, { label: '', href: '', style: 'primary' }] })} className="text-xs px-0">+ Agregar CTA</Button>
        </div>
      </Field>
    </>
  )
}

function AgentCredentialsFields({ data, onChange, binding }: { data: AgentCredentialsData; onChange: (p: Partial<AgentCredentialsData>) => void; binding?: Block['binding'] }) {
  const bLicense = isBoundField('agent-credentials', 'license', binding)
  const bYears = isBoundField('agent-credentials', 'years_experience', binding)
  const bZones = isBoundField('agent-credentials', 'zones', binding)
  const bSpecialties = isBoundField('agent-credentials', 'specialties', binding)
  const bStats = isBoundField('agent-credentials', 'stats', binding)

  return (
    <>
      <Field label="Título"><TextInput value={data.title ?? ''} onChange={e => onChange({ title: e.target.value })} /></Field>
      <Field label="Matrícula" bound={bLicense}><TextInput value={data.license ?? ''} disabled={bLicense} onChange={e => onChange({ license: e.target.value })} /></Field>
      <Field label="Años de experiencia" bound={bYears}>
        <TextInput type="number" min={0} disabled={bYears} value={data.years_experience ?? ''} onChange={e => onChange({ years_experience: e.target.value === '' ? undefined : Number(e.target.value) })} />
      </Field>
      <Field label="Zonas (separadas por coma)" bound={bZones}>
        <TextInput disabled={bZones} value={data.zones.join(', ')} onChange={e => onChange({ zones: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} />
      </Field>
      <Field label="Especialidades (separadas por coma)" bound={bSpecialties}>
        <TextInput disabled={bSpecialties} value={data.specialties.join(', ')} onChange={e => onChange({ specialties: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} />
      </Field>
      <Field label="Stats (ej: 120 propiedades vendidas)" bound={bStats}>
        {bStats ? (
          <p className="text-xs text-gray-400">{data.stats.length > 0 ? data.stats.map(s => `${s.value} ${s.label}`).join(' · ') : 'Sin datos cargados en el perfil.'}</p>
        ) : (
          <div className="space-y-2">
            {data.stats.map((s, i) => (
              <div key={i} className="flex gap-2">
                <TextInput placeholder="Valor" className="!w-20" value={s.value} onChange={e => { const stats = [...data.stats]; stats[i] = { ...s, value: e.target.value }; onChange({ stats }) }} />
                <TextInput placeholder="Label" value={s.label} onChange={e => { const stats = [...data.stats]; stats[i] = { ...s, label: e.target.value }; onChange({ stats }) }} />
                <Button variant="ghost" size="sm" onClick={() => onChange({ stats: data.stats.filter((_, j) => j !== i) })} className="text-xs text-danger px-0">Quitar</Button>
              </div>
            ))}
            <Button variant="ghost" size="sm" onClick={() => onChange({ stats: [...data.stats, { label: '', value: '' }] })} className="text-xs px-0">+ Agregar stat</Button>
          </div>
        )}
      </Field>
    </>
  )
}

function CtaWhatsappFields({ data, onChange, binding }: { data: CtaWhatsappData; onChange: (p: Partial<CtaWhatsappData>) => void; binding?: Block['binding'] }) {
  const bPhone = isBoundField('cta-whatsapp', 'phone', binding)
  return (
    <>
      <Field label="Título"><TextInput value={data.title} onChange={e => onChange({ title: e.target.value })} /></Field>
      <Field label="Subtítulo"><TextArea value={data.subtitle ?? ''} onChange={e => onChange({ subtitle: e.target.value })} /></Field>
      <Field label="Teléfono de WhatsApp" bound={bPhone}><TextInput value={data.phone} disabled={bPhone} onChange={e => onChange({ phone: e.target.value })} /></Field>
      <Field label="Mensaje predefinido"><TextArea value={data.message_template ?? ''} onChange={e => onChange({ message_template: e.target.value })} /></Field>
      <Field label="Label del botón"><TextInput value={data.button_label} onChange={e => onChange({ button_label: e.target.value })} /></Field>
    </>
  )
}
