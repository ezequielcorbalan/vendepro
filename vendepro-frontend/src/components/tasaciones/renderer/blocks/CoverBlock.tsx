import type { AppraisalContext } from '../types'

interface CoverData {
  title?: string
  subtitle?: string
  cover_image_url?: string | null
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
  [key: `data-${string}`]: string | undefined
}

export function CoverBlock({ data, appraisal, ...attrs }: Props) {
  const agent = data.agent_display ?? appraisal.agent ?? undefined
  return (
    <section
      {...attrs}
      className="relative min-h-[80vh] flex items-end text-white px-6 py-16 md:min-h-screen md:px-12"
      style={{ backgroundImage: 'linear-gradient(180deg, var(--brand-color, #ff007c) 0%, var(--brand-accent-color, #e17a2a) 100%)' }}
    >
      {data.cover_image_url && (
        <img src={data.cover_image_url} alt="" className="absolute inset-0 h-full w-full object-cover opacity-30" />
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
        <h1 className="mt-3 font-poppins text-4xl font-bold leading-tight md:text-6xl">
          {data.title ?? '¿Querés saber cuánto vale tu propiedad?'}
        </h1>
        {data.subtitle && <p className="mt-3 text-lg opacity-90 md:text-xl">{data.subtitle}</p>}
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
