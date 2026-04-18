import type { HeroSplitData } from '@/lib/landings/types'

const ACCENTS = {
  pink:   'bg-[#ff007c] hover:bg-[#e60070] text-white',
  orange: 'bg-[#ff8017] hover:bg-[#e6720f] text-white',
  dark:   'bg-gray-900 hover:bg-black text-white',
} as const

export default function HeroSplitBlock({ data }: { data: HeroSplitData; mode?: 'public' | 'editor' }) {
  const leftOrder = data.media_side === 'right' ? 'order-1 md:order-1' : 'order-1 md:order-2'
  const rightOrder = data.media_side === 'right' ? 'order-2 md:order-2' : 'order-2 md:order-1'
  return (
    <section className="grid md:grid-cols-2 bg-white">
      <div className={`${leftOrder} flex flex-col justify-center px-6 md:px-12 py-12 md:py-20`}>
        {data.eyebrow && <p className="text-xs uppercase tracking-widest font-semibold text-[#ff007c] mb-3">{data.eyebrow}</p>}
        <h1 className="text-3xl md:text-4xl font-bold leading-tight text-gray-900 mb-4">{data.title}</h1>
        {data.subtitle && <p className="text-base text-gray-600 mb-6 max-w-lg">{data.subtitle}</p>}
        {data.cta && (
          <a href={data.cta.href} className={`inline-block rounded-full px-6 py-3 font-semibold self-start ${ACCENTS[data.accent_color]}`}>
            {data.cta.label}
          </a>
        )}
      </div>
      <div className={`${rightOrder} min-h-[260px] md:min-h-[420px] bg-center bg-cover`}
        style={{ backgroundImage: `url(${data.media_url})` }}
        aria-hidden="true"
      />
    </section>
  )
}
