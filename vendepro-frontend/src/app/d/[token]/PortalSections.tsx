'use client'

import { BarChart3, Check, Circle, ExternalLink, FileSignature, Handshake } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Heading, Text } from '@/components/ui/Typography'
import { WidgetHeader } from '@/components/ui/WidgetHeader'
import { countdownLabel, formatYmd, type PublicDocPortal } from '@/lib/doc-portal'

/**
 * Reserva: la cuenta regresiva del próximo hito bien grande y la línea de
 * tiempo completa abajo. Es lo primero que quiere saber un propietario con la
 * propiedad reservada.
 */
export function ReservationSection({ reservation }: { reservation: NonNullable<PublicDocPortal['reservation']> }) {
  const next = reservation.next
  return (
    <Card className="space-y-4">
      <WidgetHeader
        icon={<Handshake className="w-4 h-4" />}
        title="Tu propiedad está reservada"
        subtitle={reservation.offer_amount != null
          ? `Oferta: ${reservation.offer_currency} ${reservation.offer_amount.toLocaleString('es-AR')}${reservation.reservation_date ? ` · reservada el ${formatYmd(reservation.reservation_date)}` : ''}`
          : undefined}
      />

      {next ? (
        <div className={`rounded-card p-4 ${next.overdue ? 'bg-danger/10' : 'bg-primary/5'}`}>
          <Text size="xs" tone="muted">Próximo paso</Text>
          <Heading level={3}>{next.label}</Heading>
          {next.date ? (
            <Text size="sm" weight="medium" tone={next.overdue ? 'danger' : 'primary'}>
              {countdownLabel(next.days_left)} · {formatYmd(next.date)}
            </Text>
          ) : (
            <Text size="sm" tone="muted">Tu agente te va a confirmar la fecha.</Text>
          )}
        </div>
      ) : (
        <Text size="sm" weight="medium" tone="success">La operación está terminada.</Text>
      )}

      <ol className="space-y-2">
        {reservation.milestones.map(m => (
          <li key={m.key} className="flex items-center gap-2">
            {m.done
              ? <Check className="w-4 h-4 text-success shrink-0" aria-label="Hecho" />
              : <Circle className="w-4 h-4 text-gray-300 shrink-0" aria-label="Pendiente" />}
            <Text size="sm" tone={m.done ? 'muted' : 'default'} className="flex-1">{m.label}</Text>
            <Text size="xs" tone="muted">{m.done ? 'Hecho' : m.date ? formatYmd(m.date) : 'A confirmar'}</Text>
          </li>
        ))}
      </ol>
    </Card>
  )
}

/** Autorización de venta: hasta cuándo rige. */
export function AuthorizationSection({ authorization }: { authorization: NonNullable<PublicDocPortal['authorization']> }) {
  const days = authorization.days_left
  const tone = days !== null && days < 0 ? 'danger' : days !== null && days <= 15 ? 'warning' : 'neutral'
  return (
    <Card className="space-y-2">
      <WidgetHeader
        icon={<FileSignature className="w-4 h-4" />}
        title="Autorización de venta"
        subtitle={`Del ${formatYmd(authorization.start_date)} al ${formatYmd(authorization.end_date)}`}
        badge={days !== null ? <Badge tone={tone}>{days < 0 ? 'Vencida' : countdownLabel(days)}</Badge> : undefined}
      />
      {days !== null && days <= 15 && (
        <Text size="xs" tone="muted">
          {days < 0 ? 'Tu agente se va a comunicar para renovarla.' : 'Está por vencer: tu agente te va a contactar para renovarla.'}
        </Text>
      )}
    </Card>
  )
}

/** Reportes de gestión publicados: cómo viene la comercialización. */
export function ReportsSection({ reports }: { reports: PublicDocPortal['reports'] }) {
  return (
    <Card className="space-y-3">
      <WidgetHeader icon={<BarChart3 className="w-4 h-4" />} title="Reportes de tu propiedad" subtitle="Visitas, consultas y cómo se está moviendo" />
      <ul className="divide-y divide-gray-100">
        {reports.map(r => (
          <li key={r.url} className="flex items-center gap-2 py-2">
            <Text size="sm" className="flex-1">{r.period_label}</Text>
            <Button href={r.url} target="_blank" rel="noopener noreferrer" variant="outline" size="sm" icon={<ExternalLink className="w-3.5 h-3.5" />}>
              Ver
            </Button>
          </li>
        ))}
      </ul>
    </Card>
  )
}
