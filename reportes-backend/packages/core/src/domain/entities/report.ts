import { ValidationError } from '../errors/validation-error'

export type ReportStatus = 'draft' | 'published'
export type MetricSource = 'zonaprop' | 'argenprop' | 'mercadolibre' | 'manual'
export type ReportSection = 'strategy' | 'marketing' | 'conclusion' | 'benchmarks' | 'price_reference'
export type PhotoType = 'visit_form' | 'property' | 'screenshot'

export interface ReportMetricProps {
  id: string
  report_id: string
  source: MetricSource
  impressions: number | null
  portal_visits: number | null
  inquiries: number | null
  phone_calls: number | null
  whatsapp: number | null
  in_person_visits: number | null
  offers: number | null
  ranking_position: number | null
  avg_market_price: number | null
  screenshot_url: string | null
  extracted_at: string | null
}

export interface ReportContentProps {
  id: string
  report_id: string
  section: ReportSection
  title: string
  body: string
  sort_order: number
}

export interface ReportPhotoProps {
  id: string
  report_id: string
  photo_url: string
  caption: string | null
  photo_type: PhotoType
  sort_order: number
}

export interface ReportProps {
  id: string
  property_id: string
  period_label: string
  period_start: string
  period_end: string
  status: ReportStatus
  created_by: string
  created_at: string
  published_at: string | null
  // Joined
  metrics?: ReportMetricProps[]
  content?: ReportContentProps[]
  photos?: ReportPhotoProps[]
  creator_name?: string
  property_address?: string
}

export class Report {
  private constructor(private props: ReportProps) {}

  static create(props: Omit<ReportProps, 'created_at'> & { created_at?: string }): Report {
    if (!props.period_label?.trim()) throw new ValidationError('Etiqueta de período es requerida')
    if (!props.period_start) throw new ValidationError('Fecha inicio es requerida')
    if (!props.period_end) throw new ValidationError('Fecha fin es requerida')
    return new Report({ ...props, created_at: props.created_at ?? new Date().toISOString() })
  }

  get id() { return this.props.id }
  get property_id() { return this.props.property_id }
  get period_label() { return this.props.period_label }
  get period_start() { return this.props.period_start }
  get period_end() { return this.props.period_end }
  get status() { return this.props.status }
  get created_by() { return this.props.created_by }
  get created_at() { return this.props.created_at }
  get published_at() { return this.props.published_at }
  get metrics() { return this.props.metrics }
  get content() { return this.props.content }
  get photos() { return this.props.photos }
  get creator_name() { return this.props.creator_name }
  get property_address() { return this.props.property_address }

  publish(): void {
    this.props.status = 'published'
    this.props.published_at = new Date().toISOString()
  }

  toObject(): ReportProps { return { ...this.props } }
}
