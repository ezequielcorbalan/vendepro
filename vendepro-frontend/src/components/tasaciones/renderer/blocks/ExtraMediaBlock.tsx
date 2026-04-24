interface Media { type: 'image' | 'video'; url: string; caption?: string }
interface Data { title?: string; media?: Media[] }
interface Props { data: Data; [key: `data-${string}`]: string | undefined }

export function ExtraMediaBlock({ data, ...attrs }: Props) {
  const media = data.media ?? []
  if (media.length === 0) return null
  return (
    <section {...attrs} className="px-6 py-10 md:px-12 md:py-16">
      <h2 className="font-poppins text-2xl font-bold md:text-3xl">{data.title ?? 'Galería'}</h2>
      <div className="mt-6 grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-4">
        {media.map((m, i) => (
          <figure key={i}>
            {m.type === 'image' ? (
              <img src={m.url} alt={m.caption ?? ''} className="aspect-square w-full rounded-lg object-cover" />
            ) : (
              <video src={m.url} controls className="aspect-square w-full rounded-lg object-cover" />
            )}
            {m.caption && <figcaption className="mt-1 text-xs text-slate-500">{m.caption}</figcaption>}
          </figure>
        ))}
      </div>
    </section>
  )
}
