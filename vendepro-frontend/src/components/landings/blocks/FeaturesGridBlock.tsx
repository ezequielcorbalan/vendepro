import * as Icons from 'lucide-react'
import type { FeaturesGridData } from '@/lib/landings/types'

function iconFor(name: string) {
  const C = (Icons as any)[name]
  return typeof C === 'function' ? C : Icons.Star
}

export default function FeaturesGridBlock({ data }: { data: FeaturesGridData; mode?: 'public' | 'editor' }) {
  const cols = data.columns === 4 ? 'md:grid-cols-4' : 'md:grid-cols-3'
  return (
    <section className="bg-white py-14 md:py-20 px-6">
      <div className="max-w-6xl mx-auto">
        {data.title && <h2 className="text-2xl md:text-3xl font-bold text-center text-gray-900 mb-3">{data.title}</h2>}
        {data.subtitle && <p className="text-center text-gray-600 max-w-2xl mx-auto mb-10">{data.subtitle}</p>}
        <div className={`grid grid-cols-1 sm:grid-cols-2 ${cols} gap-6`}>
          {data.items.map((item, i) => {
            const Icon = iconFor(item.icon)
            return (
              <div key={i} className="bg-gray-50 rounded-2xl p-6">
                <div className="w-11 h-11 rounded-xl bg-[#ff007c]/10 flex items-center justify-center text-[#ff007c] mb-4">
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">{item.title}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{item.text}</p>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
