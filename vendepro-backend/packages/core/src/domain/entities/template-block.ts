import { ValidationError } from '../errors/validation-error'

export type BlockType = 'service' | 'video' | 'stats' | 'text' | 'custom'
export type BlockSection = 'commercial' | 'conditions'

const VALID_TYPES: BlockType[] = ['service', 'video', 'stats', 'text', 'custom']
const VALID_SECTIONS: BlockSection[] = ['commercial', 'conditions']

export interface TemplateBlockProps {
  id: string
  org_id: string
  block_type: BlockType
  title: string
  description: string | null
  icon: string | null
  number_label: string | null
  video_url: string | null
  image_url: string | null
  sort_order: number
  enabled: number
  section: BlockSection
  created_at: string
  updated_at: string
}

export class TemplateBlock {
  private constructor(private props: TemplateBlockProps) {}

  static create(props: Omit<TemplateBlockProps, 'created_at' | 'updated_at'> & { created_at?: string; updated_at?: string }): TemplateBlock {
    if (!props.title?.trim()) throw new ValidationError('Título es requerido')
    if (!VALID_TYPES.includes(props.block_type)) throw new ValidationError(`Tipo de bloque inválido: "${props.block_type}"`)
    if (!VALID_SECTIONS.includes(props.section)) throw new ValidationError(`Sección inválida: "${props.section}"`)
    const now = new Date().toISOString()
    return new TemplateBlock({ ...props, created_at: props.created_at ?? now, updated_at: props.updated_at ?? now })
  }

  get id() { return this.props.id }
  get org_id() { return this.props.org_id }
  get block_type() { return this.props.block_type }
  get title() { return this.props.title }
  get description() { return this.props.description }
  get icon() { return this.props.icon }
  get number_label() { return this.props.number_label }
  get video_url() { return this.props.video_url }
  get image_url() { return this.props.image_url }
  get sort_order() { return this.props.sort_order }
  get enabled() { return this.props.enabled }
  get section() { return this.props.section }
  get created_at() { return this.props.created_at }
  get updated_at() { return this.props.updated_at }

  update(data: Partial<Omit<TemplateBlockProps, 'id' | 'org_id' | 'created_at'>>): void {
    Object.assign(this.props, data)
    this.props.updated_at = new Date().toISOString()
  }

  toObject(): TemplateBlockProps { return { ...this.props } }
}
