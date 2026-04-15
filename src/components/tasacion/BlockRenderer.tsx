import ServiceBlock from './ServiceBlock'
import VideoBlock from './VideoBlock'
import StatsBlock from './StatsBlock'
import TextBlock from './TextBlock'

interface BlockRendererProps {
  block: any
  settings: Record<string, string>
  primary: string
  accent: string
  cardClass: string
  presentationMode: boolean
}

export default function BlockRenderer({ block, settings, primary, accent, cardClass, presentationMode }: BlockRendererProps) {
  const content = (() => {
    switch (block.block_type) {
      case 'video':
        return <VideoBlock block={block} primary={primary} accent={accent} presentationMode={presentationMode} />
      case 'service':
        return <ServiceBlock block={block} primary={primary} accent={accent} presentationMode={presentationMode} />
      case 'stats':
        return <StatsBlock block={block} settings={settings} primary={primary} accent={accent} presentationMode={presentationMode} />
      case 'text':
      case 'custom':
        return <TextBlock block={block} primary={primary} accent={accent} presentationMode={presentationMode} />
      default:
        return <TextBlock block={block} primary={primary} accent={accent} presentationMode={presentationMode} />
    }
  })()

  if (!content) return null

  // Group consecutive service blocks together
  return (
    <section className={cardClass}>
      {content}
    </section>
  )
}
