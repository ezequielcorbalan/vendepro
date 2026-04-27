import { ValidationError } from '../errors/validation-error'

const TTL_MS = 30 * 24 * 60 * 60 * 1000

export interface AppraisalPdfProps {
  id: string
  org_id: string
  appraisal_id: string
  content_hash: string
  r2_key: string
  size_bytes: number
  generated_at: string
  expires_at: string
}

export class AppraisalPdf {
  private constructor(private readonly props: AppraisalPdfProps) {}

  static create(input: Omit<AppraisalPdfProps, 'expires_at'> & { expires_at?: string }): AppraisalPdf {
    if (!input.content_hash) throw new ValidationError('content_hash requerido')
    if (!input.r2_key) throw new ValidationError('r2_key requerido')
    const expires_at = input.expires_at ?? new Date(new Date(input.generated_at).getTime() + TTL_MS).toISOString()
    return new AppraisalPdf({ ...input, expires_at })
  }

  static fromPersistence(p: AppraisalPdfProps): AppraisalPdf { return new AppraisalPdf(p) }

  get id() { return this.props.id }
  get org_id() { return this.props.org_id }
  get appraisal_id() { return this.props.appraisal_id }
  get content_hash() { return this.props.content_hash }
  get r2_key() { return this.props.r2_key }
  get size_bytes() { return this.props.size_bytes }
  get generated_at() { return this.props.generated_at }
  get expires_at() { return this.props.expires_at }

  isExpired(now: Date = new Date()): boolean { return now > new Date(this.props.expires_at) }
  toObject(): AppraisalPdfProps { return { ...this.props } }
}
