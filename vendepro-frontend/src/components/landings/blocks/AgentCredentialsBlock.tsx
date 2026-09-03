import { Heading, Text } from '@/components/ui/Typography'
import { Card } from '@/components/ui/Card'
import type { AgentCredentialsData } from '@/lib/landings/types'

interface Props { data: AgentCredentialsData; mode?: 'public' | 'editor' }

export default function AgentCredentialsBlock({ data }: Props) {
  const hasNothing = !data.license && !data.years_experience && !data.zones?.length && !data.specialties?.length && !data.stats?.length
  if (hasNothing) return null
  return (
    <section className="mx-auto max-w-5xl px-6 py-14">
      {data.title && <Heading level={2} weight="semibold" className="mb-6">{data.title}</Heading>}
      {data.stats?.length > 0 && (
        <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
          {data.stats.map((s, i) => (
            <Card key={i} className="p-4 text-center">
              <Text size="lg" weight="bold">{s.value}</Text>
              <Text size="xs" tone="muted">{s.label}</Text>
            </Card>
          ))}
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        {data.license && <Text size="sm"><span className="font-semibold">Matrícula:</span> {data.license}</Text>}
        {data.years_experience != null && <Text size="sm"><span className="font-semibold">Experiencia:</span> {data.years_experience} años</Text>}
        {data.zones?.length > 0 && <Text size="sm"><span className="font-semibold">Zonas:</span> {data.zones.join(' · ')}</Text>}
        {data.specialties?.length > 0 && <Text size="sm"><span className="font-semibold">Especialidades:</span> {data.specialties.join(' · ')}</Text>}
      </div>
    </section>
  )
}
