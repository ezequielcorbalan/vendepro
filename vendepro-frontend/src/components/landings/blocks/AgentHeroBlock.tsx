import { Heading, Text } from '@/components/ui/Typography'
import { WhatsAppButton } from '@/components/ui/ContactButtons'
import { Button } from '@/components/ui/Button'
import type { AgentHeroData } from '@/lib/landings/types'

interface Props { data: AgentHeroData; mode?: 'public' | 'editor' }

export default function AgentHeroBlock({ data }: Props) {
  // `accent_color` es del dato del bloque (pink|orange|dark), no un estado de UI.
  // Se mapea a tokens; `primary` es el token semántico del rosa de marca.
  const accent = data.accent_color === 'orange' ? 'text-brand-orange' : data.accent_color === 'dark' ? 'text-ink' : 'text-primary'
  return (
    <section className="relative w-full overflow-hidden bg-white">
      {data.background_image_url && (
        <img src={data.background_image_url} alt="" className="absolute inset-0 h-full w-full object-cover opacity-15" />
      )}
      <div className="relative mx-auto flex max-w-5xl flex-col items-center gap-8 px-6 py-16 md:flex-row md:py-24">
        <img
          src={data.photo_url}
          alt={data.name}
          className="h-40 w-40 shrink-0 rounded-full object-cover shadow-card md:h-56 md:w-56"
        />
        <div className="flex flex-col items-center gap-3 text-center md:items-start md:text-left">
          {data.headline && <Text size="sm" weight="semibold" className={accent}>{data.headline}</Text>}
          <Heading level={1}>{data.name}</Heading>
          {data.bio && <Text size="base" tone="muted" className="max-w-prose">{data.bio}</Text>}
          {data.ctas?.length > 0 && (
            <div className="mt-2 flex flex-wrap justify-center gap-3 md:justify-start">
              {data.ctas.map((cta, i) =>
                cta.style === 'whatsapp'
                  ? <WhatsAppButton key={i} phone={cta.href} label={cta.label} />
                  : <a key={i} href={cta.href}><Button variant={cta.style === 'primary' ? 'primary' : 'outline'}>{cta.label}</Button></a>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
