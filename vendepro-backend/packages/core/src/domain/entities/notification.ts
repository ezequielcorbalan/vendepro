import { ValidationError } from '../errors/validation-error'

export type NotificationKind = 'lead_assigned' | 'task_overdue' | 'reservation_update' | 'system'

export const NOTIFICATION_KINDS: NotificationKind[] = [
  'lead_assigned',
  'task_overdue',
  'reservation_update',
  'system',
]

export interface NotificationProps {
  id: string
  org_id: string
  user_id: string
  kind: NotificationKind
  title: string
  body: string | null
  link_url: string | null
  read: boolean
  created_at: string
}

export class Notification {
  private constructor(private props: NotificationProps) {}

  static create(
    props: Omit<NotificationProps, 'created_at'> & { created_at?: string }
  ): Notification {
    if (!props.title || props.title.trim().length === 0) {
      throw new ValidationError('Título es requerido', { title: 'Requerido' })
    }
    if (!NOTIFICATION_KINDS.includes(props.kind)) {
      throw new ValidationError(`Tipo de notificación inválido: "${props.kind}"`, {
        kind: 'Inválido',
      })
    }
    const now = new Date().toISOString()
    return new Notification({
      ...props,
      created_at: props.created_at ?? now,
    })
  }

  get id() { return this.props.id }
  get org_id() { return this.props.org_id }
  get user_id() { return this.props.user_id }
  get kind() { return this.props.kind }
  get title() { return this.props.title }
  get body() { return this.props.body }
  get link_url() { return this.props.link_url }
  get read() { return this.props.read }
  get created_at() { return this.props.created_at }

  markRead(): Notification {
    return new Notification({ ...this.props, read: true })
  }

  toObject(): NotificationProps {
    return { ...this.props }
  }
}
