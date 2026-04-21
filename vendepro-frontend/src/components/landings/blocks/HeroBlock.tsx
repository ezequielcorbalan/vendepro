import type { HeroData } from '@/lib/landings/types'

interface Props { data: HeroData; mode?: 'public' | 'editor' }

export default function HeroBlock({ data }: Props) {
  return (
    <section
      className="relative flex items-end min-h-[420px] md:min-h-[520px] bg-center bg-cover text-white"
      style={{ backgroundImage: `url(${data.background_image_url})` }}
    >
      <div
        className="absolute inset-0 bg-gradient-to-b from-black/10 to-black"
        style={{ opacity: data.overlay_opacity }}
        aria-hidden="true"
      />
      <div className="relative z-10 w-full max-w-5xl mx-auto px-6 pb-12 md:pb-20">
        {data.eyebrow && (
          <p className="text-xs md:text-sm uppercase tracking-widest font-semibold mb-3 opacity-90">{data.eyebrow}</p>
        )}
        <h1 className="text-3xl md:text-5xl font-bold leading-tight mb-3">{data.title}</h1>
        {data.subtitle && <p className="text-base md:text-lg opacity-90 mb-6 max-w-2xl">{data.subtitle}</p>}
        {data.cta && (
          <a
            href={data.cta.href}
            className="inline-block bg-[#ff007c] hover:bg-[#e60070] text-white font-semibold px-7 py-3 rounded-full transition-colors"
          >
            {data.cta.label}
          </a>
        )}
      </div>
    </section>
  )
}
