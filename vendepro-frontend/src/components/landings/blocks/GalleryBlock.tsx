'use client'
import { useState } from 'react'
import type { GalleryData } from '@/lib/landings/types'

export default function GalleryBlock({ data }: { data: GalleryData; mode?: 'public' | 'editor' }) {
  const [active, setActive] = useState(0)
  if (data.images.length === 0) return null

  if (data.layout === 'carousel') {
    return (
      <section className="bg-white py-10 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="aspect-[16/9] bg-gray-100 rounded-2xl overflow-hidden bg-cover bg-center"
            style={{ backgroundImage: `url(${data.images[active].url})` }} aria-label={data.images[active].alt ?? ''} />
          <div className="flex gap-2 overflow-x-auto mt-3">
            {data.images.map((img, i) => (
              <button key={i} onClick={() => setActive(i)} className={`flex-shrink-0 w-20 h-14 rounded-lg bg-cover bg-center border-2 transition-colors ${i === active ? 'border-[#ff007c]' : 'border-transparent'}`}
                style={{ backgroundImage: `url(${img.url})` }} aria-label={`Foto ${i + 1}`} />
            ))}
          </div>
        </div>
      </section>
    )
  }

  if (data.layout === 'mosaic') {
    const [first, ...rest] = data.images
    return (
      <section className="bg-white py-10 px-6">
        <div className="max-w-6xl mx-auto grid grid-cols-3 grid-rows-2 gap-2 aspect-[16/9]">
          <div className="col-span-2 row-span-2 bg-cover bg-center rounded-xl" style={{ backgroundImage: `url(${first.url})` }} />
          {rest.slice(0, 4).map((img, i) => (
            <div key={i} className="bg-cover bg-center rounded-xl" style={{ backgroundImage: `url(${img.url})` }} />
          ))}
        </div>
      </section>
    )
  }

  // grid
  return (
    <section className="bg-white py-10 px-6">
      <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {data.images.map((img, i) => (
          <div key={i} className="aspect-square bg-cover bg-center rounded-xl" style={{ backgroundImage: `url(${img.url})` }} aria-label={img.alt ?? ''} />
        ))}
      </div>
    </section>
  )
}
