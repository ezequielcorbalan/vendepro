import { validateBlocks, type Block } from '../value-objects/block-schemas'
import { ValidationError } from '../errors/validation-error'
import type { LandingKind } from './landing'

export interface LandingTemplateProps {
  id: string
  org_id: string | null       // null = global
  name: string
  kind: LandingKind
  description: string | null
  preview_image_url: string | null
  blocks: Block[]
  active: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export class LandingTemplate {
  private constructor(private readonly props: LandingTemplateProps) {}

  static create(input: Omit<LandingTemplateProps, 'created_at' | 'updated_at'> & { created_at?: string; updated_at?: string }): LandingTemplate {
    if (!input.name || input.name.trim().length < 2) {
      throw new ValidationError('name es requerido (mín 2 chars)')
    }
    if (input.kind !== 'lead_capture' && input.kind !== 'property') {
      throw new ValidationError(`kind inválido: "${input.kind}"`)
    }
    const v = validateBlocks(input.blocks)
    if (!v.success) throw new ValidationError(`Bloques inválidos: ${v.error}`)
    const leadForms = v.data.filter(b => b.type === 'lead-form')
    if (leadForms.length !== 1) throw new ValidationError('El template debe tener un único bloque lead-form')

    const now = new Date().toISOString()
    return new LandingTemplate({
      ...input,
      blocks: v.data,
      created_at: input.created_at ?? now,
      updated_at: input.updated_at ?? now,
    })
  }

  static fromPersistence(props: LandingTemplateProps): LandingTemplate { return new LandingTemplate(props) }

  get id() { return this.props.id }
  get org_id() { return this.props.org_id }
  get name() { return this.props.name }
  get kind() { return this.props.kind }
  get description() { return this.props.description }
  get preview_image_url() { return this.props.preview_image_url }
  get blocks(): Block[] { return this.props.blocks }
  get active() { return this.props.active }
  get sort_order() { return this.props.sort_order }
  get created_at() { return this.props.created_at }
  get updated_at() { return this.props.updated_at }

  toObject(): LandingTemplateProps { return { ...this.props, blocks: [...this.props.blocks] } }

  isGlobal(): boolean { return this.props.org_id === null }
}
