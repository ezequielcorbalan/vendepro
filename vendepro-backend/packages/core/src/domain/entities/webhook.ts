import { ValidationError } from '../errors/validation-error'

// Eventos que pueden suscribirse los webhooks salientes. Extensible.
export const WEBHOOK_EVENTS = ['lead.created', 'lead.stage_changed', 'appraisal.created'] as const
export type WebhookEventKey = (typeof WEBHOOK_EVENTS)[number]

export interface WebhookProps {
  id: string
  org_id: string
  name: string | null
  url: string
  secret: string
  events: string[]
  is_active: boolean
  last_triggered_at: string | null
  created_at: string
  updated_at: string
}

export class Webhook {
  private constructor(private props: WebhookProps) {}

  static create(
    props: Omit<WebhookProps, 'created_at' | 'updated_at'> & { created_at?: string; updated_at?: string },
  ): Webhook {
    if (!/^https?:\/\/.+/i.test(props.url ?? '')) {
      throw new ValidationError('La URL del webhook debe ser http(s) válida', { url: 'Inválida' })
    }
    if (!props.secret) {
      throw new ValidationError('El secret del webhook es requerido', { secret: 'Requerido' })
    }
    if (!props.events || props.events.length === 0) {
      throw new ValidationError('Al menos un evento es requerido', { events: 'Requerido' })
    }
    const invalid = props.events.filter((e) => !(WEBHOOK_EVENTS as readonly string[]).includes(e))
    if (invalid.length > 0) {
      throw new ValidationError(`Eventos desconocidos: ${invalid.join(', ')}`, { events: 'Inválido' })
    }
    const now = new Date().toISOString()
    return new Webhook({
      ...props,
      name: props.name?.trim() || null,
      url: props.url.trim(),
      created_at: props.created_at ?? now,
      updated_at: props.updated_at ?? now,
    })
  }

  // ── Getters ──────────────────────────────────────────
  get id() { return this.props.id }
  get org_id() { return this.props.org_id }
  get name() { return this.props.name }
  get url() { return this.props.url }
  get secret() { return this.props.secret }
  get events() { return this.props.events }
  get is_active() { return this.props.is_active }
  get last_triggered_at() { return this.props.last_triggered_at }
  get created_at() { return this.props.created_at }
  get updated_at() { return this.props.updated_at }

  // ── Domain Methods ──────────────────────────────────
  listensTo(event: string): boolean {
    return this.props.events.includes(event)
  }

  update(changes: { name?: string | null; url?: string; events?: string[]; is_active?: boolean }): Webhook {
    return Webhook.create({
      ...this.props,
      ...(changes.name !== undefined ? { name: changes.name } : {}),
      ...(changes.url !== undefined ? { url: changes.url } : {}),
      ...(changes.events !== undefined ? { events: changes.events } : {}),
      ...(changes.is_active !== undefined ? { is_active: changes.is_active } : {}),
      created_at: this.props.created_at,
      updated_at: new Date().toISOString(),
    })
  }

  toObject(): WebhookProps {
    return { ...this.props }
  }
}
