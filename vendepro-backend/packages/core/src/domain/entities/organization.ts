export interface SurfaceWeights {
  covered: number
  semi: number
  uncovered: number
}

export const DEFAULT_SURFACE_WEIGHTS: SurfaceWeights = { covered: 1, semi: 0.75, uncovered: 0.25 }

export interface OrganizationProps {
  id: string
  name: string
  slug: string
  logo_url: string | null
  brand_color: string
  brand_accent_color: string | null
  canva_template_id: string | null
  canva_report_template_id: string | null
  surface_weights: SurfaceWeights
  owner_id: string | null
  created_at: string
}

export class Organization {
  private constructor(private props: OrganizationProps) {}

  static create(props: Omit<OrganizationProps, 'created_at'> & { created_at?: string }): Organization {
    return new Organization({ ...props, created_at: props.created_at ?? new Date().toISOString() })
  }

  get id() { return this.props.id }
  get name() { return this.props.name }
  get slug() { return this.props.slug }
  get logo_url() { return this.props.logo_url }
  get brand_color() { return this.props.brand_color }
  get brand_accent_color() { return this.props.brand_accent_color }
  get canva_template_id() { return this.props.canva_template_id }
  get canva_report_template_id() { return this.props.canva_report_template_id }
  get surface_weights() { return this.props.surface_weights }
  get owner_id() { return this.props.owner_id }
  get created_at() { return this.props.created_at }

  toObject(): OrganizationProps { return { ...this.props } }
}
