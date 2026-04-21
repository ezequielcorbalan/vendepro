import type { AmenitiesChipsData } from '@/lib/landings/types'

export default function AmenitiesChipsBlock({ data }: { data: AmenitiesChipsData; mode?: 'public' | 'editor' }) {
  return (
    <section className="bg-gray-50 py-12 md:py-16 px-6">
      <div className="max-w-5xl mx-auto">
        {data.title && <h2 className="text-xl md:text-2xl font-semibold text-gray-900 mb-6 text-center">{data.title}</h2>}
        <div className="flex flex-wrap gap-2.5 justify-center">
          {data.chips.map((chip, i) => (
            <span key={i} className="inline-flex items-center gap-2 bg-white border border-gray-200 rounded-full px-5 py-2.5 shadow-sm text-sm text-gray-800 font-medium">
              {chip.emoji && <span aria-hidden="true">{chip.emoji}</span>}
              {chip.label}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}
