import { validateBlocks, type Block } from '../value-objects/block-schemas'
import { ValidationError } from '../errors/validation-error'

export type VersionLabel = 'auto-save' | 'manual-save' | 'ai-edit' | 'publish'

export interface LandingVersionProps {
  id: string
  landing_id: string
  version_number: number
  blocks: Block[]
  label: VersionLabel
  created_by: string
  created_at: string
}

const VALID_LABELS: VersionLabel[] = ['auto-save', 'manual-save', 'ai-edit', 'publish']

export class LandingVersion {
  private constructor(private readonly props: LandingVersionProps) {}

  static create(input: Omit<LandingVersionProps, 'created_at'> & { created_at?: string }): LandingVersion {
    if (!VALID_LABELS.includes(input.label)) throw new ValidationError(`label inválido: "${input.label}"`)
    if (!Number.isInteger(input.version_number) || input.version_number < 1) {
      throw new ValidationError('version_number debe ser un entero >= 1')
    }
    const v = validateBlocks(input.blocks)
    if (!v.success) throw new ValidationError(`Bloques inválidos en versión: ${v.error}`)
    return new LandingVersion({ ...input, blocks: v.data, created_at: input.created_at ?? new Date().toISOString() })
  }

  static fromPersistence(props: LandingVersionProps): LandingVersion { return new LandingVersion(props) }

  get id() { return this.props.id }
  get landing_id() { return this.props.landing_id }
  get version_number() { return this.props.version_number }
  get blocks(): Block[] { return this.props.blocks }
  get label() { return this.props.label }
  get created_by() { return this.props.created_by }
  get created_at() { return this.props.created_at }

  toObject(): LandingVersionProps { return { ...this.props, blocks: [...this.props.blocks] } }

  isImmutable(): boolean { return this.props.label === 'publish' }
}
