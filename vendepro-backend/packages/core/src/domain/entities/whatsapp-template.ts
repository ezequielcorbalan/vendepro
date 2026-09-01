/**
 * Mensaje predeterminado de WhatsApp de la org — el equivalente a las
 * respuestas rápidas de WhatsApp Business. El cuerpo puede traer variables
 * `{{...}}` que se resuelven al abrir el chat, con los datos del lead o
 * contacto.
 */
export const WHATSAPP_TEMPLATE_VARIABLES = ['nombre', 'agente', 'inmobiliaria', 'direccion'] as const
export type WhatsAppTemplateVariable = typeof WHATSAPP_TEMPLATE_VARIABLES[number]

export interface WhatsAppTemplateProps {
  id: string
  org_id: string
  name: string
  body: string
  sort_order: number
  is_active: number
  created_by: string | null
  created_at: string
  updated_at: string
}

export class WhatsAppTemplate {
  private constructor(private props: WhatsAppTemplateProps) {}

  static create(
    props: Omit<WhatsAppTemplateProps, 'sort_order' | 'is_active' | 'created_by' | 'created_at' | 'updated_at'> &
      Partial<Pick<WhatsAppTemplateProps, 'sort_order' | 'is_active' | 'created_by' | 'created_at' | 'updated_at'>>,
  ): WhatsAppTemplate {
    const name = props.name?.trim()
    const body = props.body?.trim()
    if (!name) throw new Error('El nombre del mensaje es obligatorio')
    if (!body) throw new Error('El texto del mensaje es obligatorio')

    const now = new Date().toISOString()
    return new WhatsAppTemplate({
      ...props,
      name,
      body,
      sort_order: props.sort_order ?? 0,
      is_active: props.is_active ?? 1,
      created_by: props.created_by ?? null,
      created_at: props.created_at ?? now,
      updated_at: props.updated_at ?? now,
    })
  }

  get id() { return this.props.id }
  get org_id() { return this.props.org_id }
  get name() { return this.props.name }
  get body() { return this.props.body }
  get sort_order() { return this.props.sort_order }
  get is_active() { return this.props.is_active }
  get created_by() { return this.props.created_by }
  get created_at() { return this.props.created_at }
  get updated_at() { return this.props.updated_at }

  toObject(): WhatsAppTemplateProps { return { ...this.props } }
}
