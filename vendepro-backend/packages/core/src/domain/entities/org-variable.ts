import { ValidationError } from '../errors/validation-error'

export const ORG_VARIABLE_TYPES = ['number', 'percent', 'text', 'date', 'image_url'] as const
export type OrgVariableType = typeof ORG_VARIABLE_TYPES[number]

export const ORG_VARIABLE_NAMESPACES = ['market', 'notary', 'custom'] as const
export type OrgVariableNamespace = typeof ORG_VARIABLE_NAMESPACES[number]

const KEY_REGEX = /^[a-z][a-z0-9_]*(\.[a-z0-9_]+)+$/i

export interface OrgVariableProps {
  id: string
  org_id: string
  key: string
  value: string
  value_type: OrgVariableType
  label: string | null
  namespace: OrgVariableNamespace
  is_system: boolean
  updated_at: string
}

export class OrgVariable {
  private constructor(private readonly props: OrgVariableProps) {}

  static create(input: Omit<OrgVariableProps, 'updated_at'> & { updated_at?: string }): OrgVariable {
    if (!KEY_REGEX.test(input.key)) throw new ValidationError(`key inválido: "${input.key}" (formato: namespace.sub_key)`)
    if (!(ORG_VARIABLE_TYPES as readonly string[]).includes(input.value_type)) throw new ValidationError(`value_type inválido: "${input.value_type}"`)
    if (!(ORG_VARIABLE_NAMESPACES as readonly string[]).includes(input.namespace)) throw new ValidationError(`namespace inválido: "${input.namespace}"`)

    const declared = input.key.split('.')[0]
    if (declared !== input.namespace) throw new ValidationError(`namespace "${input.namespace}" no coincide con prefijo de key "${input.key}"`)

    return new OrgVariable({ ...input, updated_at: input.updated_at ?? new Date().toISOString() })
  }

  static fromPersistence(p: OrgVariableProps): OrgVariable { return new OrgVariable(p) }

  get id() { return this.props.id }
  get org_id() { return this.props.org_id }
  get key() { return this.props.key }
  get value() { return this.props.value }
  get value_type() { return this.props.value_type }
  get label() { return this.props.label }
  get namespace() { return this.props.namespace }
  get updated_at() { return this.props.updated_at }

  isSystem(): boolean { return this.props.is_system }

  toObject(): OrgVariableProps { return { ...this.props } }
}
