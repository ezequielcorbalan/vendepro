import { Check } from 'lucide-react'
import type { BenefitsListData } from '@/lib/landings/types'

export default function BenefitsListBlock({ data }: { data: BenefitsListData; mode?: 'public' | 'editor' }) {
  return (
    <section className="bg-white py-14 px-6">
      <div className="max-w-3xl mx-auto">
        {data.title && <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-8">{data.title}</h2>}
        <div className="space-y-5">
          {data.items.map((item, i) => (
            <div key={i} className="flex gap-4">
              <div className="w-10 h-10 rounded-xl bg-[#ff007c]/10 flex items-center justify-center text-[#ff007c] flex-shrink-0">
                <Check className="w-5 h-5" strokeWidth={3} />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-0.5">{item.title}</h3>
                {item.description && <p className="text-sm text-gray-600 leading-relaxed">{item.description}</p>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
