import { ValidationError } from '../errors/validation-error'
import { validateAppraisalBlocks, type AppraisalTemplateBlock } from '../value-objects/appraisal-block-schemas'

export const APPRAISAL_TEMPLATE_KINDS = ['casa', 'depto', 'terreno', 'corporativo', 'custom'] as const
export type AppraisalTemplateKind = typeof APPRAISAL_TEMPLATE_KINDS[number]

export interface AppraisalTemplateProps {
  id: string
  org_id: string | null
  kind: AppraisalTemplateKind
  name: string
  description: string | null
  preview_image_url: string | null
  blocks: AppraisalTemplateBlock[]
  is_system: boolean
  parent_template_id: string | null
  active: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export class AppraisalTemplate {
  private constructor(private readonly props: AppraisalTemplateProps) {}

  static create(input: Omit<AppraisalTemplateProps, 'created_at' | 'updated_at'> & { created_at?: string; updated_at?: string }): AppraisalTemplate {
    if (!input.name || input.name.trim().length < 2) throw new ValidationError('name es requerido (mín 2 chars)')
    if (!(APPRAISAL_TEMPLATE_KINDS as readonly string[]).includes(input.kind)) {
      throw new ValidationError(`kind inválido: "${input.kind}"`)
    }
    const v = validateAppraisalBlocks(input.blocks)
    if (!v.success) throw new ValidationError(`Bloques inválidos: ${v.error}`)

    const now = new Date().toISOString()
    return new AppraisalTemplate({
      ...input, blocks: v.data,
      created_at: input.created_at ?? now, updated_at: input.updated_at ?? now,
    })
  }

  static fromPersistence(props: AppraisalTemplateProps): AppraisalTemplate { return new AppraisalTemplate(props) }

  get id() { return this.props.id }
  get org_id() { return this.props.org_id }
  get kind() { return this.props.kind }
  get name() { return this.props.name }
  get description() { return this.props.description }
  get preview_image_url() { return this.props.preview_image_url }
  get blocks(): AppraisalTemplateBlock[] { return this.props.blocks }
  get is_system() { return this.props.is_system }
  get parent_template_id() { return this.props.parent_template_id }
  get active() { return this.props.active }
  get sort_order() { return this.props.sort_order }
  get created_at() { return this.props.created_at }
  get updated_at() { return this.props.updated_at }

  isGlobal(): boolean { return this.props.org_id === null }
  isSystem(): boolean { return this.props.is_system }

  duplicateFor(orgId: string, newId: string, newName?: string): AppraisalTemplate {
    return AppraisalTemplate.create({
      id: newId, org_id: orgId, kind: this.props.kind,
      name: newName ?? `${this.props.name} (copia)`,
      description: this.props.description, preview_image_url: this.props.preview_image_url,
      blocks: this.props.blocks.map(b => ({ ...b, data: structuredClone(b.data) })),
      is_system: false, parent_template_id: this.props.id,
      active: true, sort_order: this.props.sort_order,
    })
  }

  toObject(): AppraisalTemplateProps { return { ...this.props, blocks: this.props.blocks.map(b => ({ ...b })) } }
}
