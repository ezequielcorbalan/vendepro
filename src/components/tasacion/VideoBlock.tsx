interface VideoBlockProps {
  block: any
  primary: string
  accent: string
  presentationMode: boolean
}

function youtubeEmbed(url: string) {
  if (!url) return null
  const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]+)/)
  if (match) return `https://www.youtube-nocookie.com/embed/${match[1]}`
  if (url.includes('youtube.com/embed/')) return url.replace('youtube.com', 'youtube-nocookie.com')
  if (url.includes('youtube-nocookie.com')) return url
  return url
}

export default function VideoBlock({ block, primary, accent, presentationMode }: VideoBlockProps) {
  const embedUrl = block.video_url ? youtubeEmbed(block.video_url) : null
  if (!embedUrl) return null

  return (
    <div className="overflow-hidden">
      <div className="aspect-video">
        <iframe
          src={embedUrl}
          className="w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
      {block.description && (
        <div className="p-5 sm:p-8">
          <h2 className={`text-lg sm:text-xl font-semibold mb-3 flex items-center gap-2 ${presentationMode ? 'text-white' : 'text-gray-800'}`}>
            <span className="w-1 h-7 rounded-full" style={{ background: `linear-gradient(to bottom, ${primary}, ${accent})` }} />
            {block.title}
          </h2>
          <p className={`text-sm sm:text-base leading-relaxed whitespace-pre-wrap ${presentationMode ? 'text-gray-300' : 'text-gray-600'}`}>
            {block.description}
          </p>
        </div>
      )}
    </div>
  )
}
