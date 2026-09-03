import { ChevronDown } from 'lucide-react'
import { Heading, Text } from '@/components/ui/Typography'
import type { FaqData } from '@/lib/landings/types'

interface Props { data: FaqData; mode?: 'public' | 'editor' }

export default function FaqBlock({ data }: Props) {
  return (
    <section className="mx-auto max-w-3xl px-6 py-14">
      {data.title && <Heading level={2} weight="semibold" className="mb-6">{data.title}</Heading>}
      <div className="flex flex-col gap-3">
        {data.items.map((item, i) => (
          <details key={i} className="group rounded-card border border-gray-200 p-4">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 [&::-webkit-details-marker]:hidden">
              <Text size="sm" weight="semibold" as="span">{item.question}</Text>
              <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" />
            </summary>
            <Text size="sm" tone="muted" className="mt-3">{item.answer}</Text>
          </details>
        ))}
      </div>
    </section>
  )
}
