'use client'
import { Heading, Text } from '@/components/ui/Typography'
import { WhatsAppButton } from '@/components/ui/ContactButtons'
import type { CtaWhatsappData } from '@/lib/landings/types'

interface Props { data: CtaWhatsappData; mode?: 'public' | 'editor' }

export default function CtaWhatsappBlock({ data }: Props) {
  return (
    <section className="bg-gray-50 px-6 py-14">
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-4 text-center">
        <Heading level={2} weight="semibold">{data.title}</Heading>
        {data.subtitle && <Text size="base" tone="muted">{data.subtitle}</Text>}
        <WhatsAppButton phone={data.phone} message={data.message_template} label={data.button_label} className="mt-2" />
      </div>
    </section>
  )
}
