interface Video { url: string; caption?: string; provider: 'youtube' | 'vimeo' | 'r2' }
interface Data { title?: string; videos?: Video[] }
interface Props { data: Data; [key: `data-${string}`]: string | undefined }

function embedUrl(v: Video): string {
  if (v.provider === 'youtube') {
    const id = v.url.match(/(?:v=|youtu\.be\/)([^&]+)/)?.[1]
    return id ? `https://www.youtube.com/embed/${id}` : v.url
  }
  if (v.provider === 'vimeo') {
    const id = v.url.match(/vimeo\.com\/(\d+)/)?.[1]
    return id ? `https://player.vimeo.com/video/${id}` : v.url
  }
  return v.url
}

export function VideoGalleryBlock({ data, ...attrs }: Props) {
  const videos = data.videos ?? []
  if (videos.length === 0) return null
  return (
    <section {...attrs} className="px-6 py-10 md:px-12 md:py-16">
      <h2 className="font-poppins text-2xl font-bold md:text-3xl">{data.title ?? 'Videos'}</h2>
      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        {videos.map((v, i) => (
          <figure key={i}>
            {v.provider === 'r2' ? (
              <video src={v.url} controls className="w-full rounded-lg" />
            ) : (
              <iframe src={embedUrl(v)} title={v.caption ?? 'Video'} className="aspect-video w-full rounded-lg" allowFullScreen />
            )}
            {v.caption && <figcaption className="mt-2 text-sm text-slate-600">{v.caption}</figcaption>}
          </figure>
        ))}
      </div>
    </section>
  )
}
