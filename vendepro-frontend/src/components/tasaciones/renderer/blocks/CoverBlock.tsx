import type { AppraisalContext } from '../types'
import { InlineEditable } from './InlineEditable'
import { ImageEditControls } from './ImageEditControls'

interface CoverData {
  title?: string
  subtitle?: string
  cover_image_url?: string | null
  background_color?: string | null
  agent_display?: {
    name?: string
    phone?: string
    email?: string
    avatar_url?: string | null
  }
}

interface Props {
  data: CoverData
  appraisal: AppraisalContext
  edit?: { onChange: (patch: Partial<CoverData>) => void }
  [key: `data-${string}`]: string | undefined
}

export function CoverBlock({ data, appraisal, edit, ...attrs }: Props) {
  const agent = data.agent_display ?? appraisal.agent ?? undefined
  const hasCoverImage = !!data.cover_image_url
  const sizeClasses = hasCoverImage
    ? 'min-h-[80vh] py-16 md:min-h-screen'
    : 'min-h-[40vh] py-12 md:min-h-[50vh]'
  const sectionStyle = data.background_color
    ? { backgroundColor: data.background_color }
    : { backgroundImage: 'linear-gradient(180deg, var(--brand-color, #ff007c) 0%, var(--brand-accent-color, #e17a2a) 100%)' }
  return (
    <section
      {...attrs}
      className={`relative flex items-end text-white px-6 md:px-12 ${sizeClasses}`}
      style={sectionStyle}
    >
      {data.cover_image_url && (
        <img src={data.cover_image_url} alt="" className="absolute inset-0 h-full w-full object-cover opacity-30" />
      )}
      {edit && (
        <div className="absolute right-4 top-4 z-20">
          <ImageEditControls compact={hasCoverImage} onUploaded={(url) => edit.onChange({ cover_image_url: url })} />
        </div>
      )}
      {appraisal.org?.logo_url && (
        <img
          src={appraisal.org.logo_url}
          alt={appraisal.org.name ?? ''}
          className="absolute top-6 left-6 z-10 h-10 w-auto object-contain md:top-12 md:left-12 md:h-14"
        />
      )}
      <div className="relative z-10 max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] opacity-90 md:text-sm">
          Tasación profesional
        </p>
        {edit ? (
          <InlineEditable
            as="h1"
            plaintext
            value={data.title ?? ''}
            placeholder="¿Querés saber cuánto vale tu propiedad?"
            className="mt-3 font-poppins text-4xl font-bold leading-tight md:text-6xl"
            onCommit={(title) => edit.onChange({ title })}
          />
        ) : (
          <h1 className="mt-3 font-poppins text-4xl font-bold leading-tight md:text-6xl">
            {data.title ?? '¿Querés saber cuánto vale tu propiedad?'}
          </h1>
        )}
        {edit ? (
          <InlineEditable
            as="p"
            plaintext
            value={data.subtitle ?? ''}
            placeholder="Subtítulo (opcional)…"
            className="mt-3 text-lg opacity-90 md:text-xl"
            onCommit={(subtitle) => edit.onChange({ subtitle })}
          />
        ) : data.subtitle ? (
          <p className="mt-3 text-lg opacity-90 md:text-xl">{data.subtitle}</p>
        ) : null}
        <p className="mt-6 text-sm opacity-90 md:text-base">
          {appraisal.property_address}
          {appraisal.neighborhood ? ` · ${appraisal.neighborhood}` : ''}
        </p>
        {agent?.name && (
          <div className="mt-8 flex items-center gap-3">
            {agent.avatar_url && <img src={agent.avatar_url} alt="" className="h-12 w-12 rounded-full object-cover ring-2 ring-white/30" />}
            <div>
              <p className="font-semibold">{agent.name}</p>
              {agent.phone && <p className="text-sm opacity-80">{agent.phone}</p>}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
