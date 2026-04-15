export interface TagProps {
  id: string
  org_id: string
  name: string
  color: string
  is_default: number
  created_at: string
}

export class Tag {
  private constructor(private props: TagProps) {}

  static create(props: Omit<TagProps, 'created_at'> & { created_at?: string }): Tag {
    return new Tag({ ...props, created_at: props.created_at ?? new Date().toISOString() })
  }

  get id() { return this.props.id }
  get org_id() { return this.props.org_id }
  get name() { return this.props.name }
  get color() { return this.props.color }
  get is_default() { return this.props.is_default }
  get created_at() { return this.props.created_at }

  toObject(): TagProps { return { ...this.props } }
}
