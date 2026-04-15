export interface ObjectiveProps {
  id: string
  org_id: string
  agent_id: string
  metric: string
  target: number
  period_type: string
  period_start: string
  period_end: string
  created_at: string
  updated_at: string
}

export class Objective {
  private constructor(private props: ObjectiveProps) {}

  static create(props: Omit<ObjectiveProps, 'created_at' | 'updated_at'> & { created_at?: string; updated_at?: string }): Objective {
    const now = new Date().toISOString()
    return new Objective({ ...props, created_at: props.created_at ?? now, updated_at: props.updated_at ?? now })
  }

  get id() { return this.props.id }
  get org_id() { return this.props.org_id }
  get agent_id() { return this.props.agent_id }
  get metric() { return this.props.metric }
  get target() { return this.props.target }
  get period_type() { return this.props.period_type }
  get period_start() { return this.props.period_start }
  get period_end() { return this.props.period_end }
  get created_at() { return this.props.created_at }
  get updated_at() { return this.props.updated_at }

  toObject(): ObjectiveProps { return { ...this.props } }
}
