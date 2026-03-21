// ============================================================
// Database types for the Reportes App
// ============================================================

export type UserRole = 'owner' | 'admin' | 'agent'
export type PropertyStatus = 'active' | 'sold' | 'suspended' | 'archived'
export type PropertyType = 'departamento' | 'casa' | 'ph' | 'local' | 'terreno' | 'oficina'
export type ReportStatus = 'draft' | 'published'
export type MetricSource = 'zonaprop' | 'argenprop' | 'mercadolibre' | 'manual'
export type ReportSection = 'strategy' | 'marketing' | 'conclusion' | 'benchmarks' | 'price_reference'
export type PhotoType = 'visit_form' | 'property' | 'screenshot'

export interface Organization {
  id: string
  name: string
  slug: string
  logo_url: string | null
  brand_color: string
  canva_template_id: string | null
  owner_id: string | null
  created_at: string
}

export interface Profile {
  id: string
  full_name: string
  email: string
  phone: string | null
  photo_url: string | null
  role: UserRole
  org_id: string | null
  created_at: string
}

export interface Property {
  id: string
  address: string
  neighborhood: string
  city: string
  property_type: PropertyType
  rooms: number | null
  size_m2: number | null
  asking_price: number | null
  currency: 'USD' | 'ARS'
  owner_name: string
  owner_phone: string | null
  owner_email: string | null
  public_slug: string
  cover_photo: string | null
  agent_id: string
  status: PropertyStatus
  created_at: string
  updated_at: string
  // Joined
  agent?: Profile
  reports?: Report[]
}

export interface Report {
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
  property?: Property
  metrics?: ReportMetric[]
  content?: ReportContent[]
  photos?: ReportPhoto[]
  creator?: Profile
}

export interface ReportMetric {
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

export interface ReportContent {
  id: string
  report_id: string
  section: ReportSection
  title: string
  body: string
  sort_order: number
}

export interface ReportPhoto {
  id: string
  report_id: string
  photo_url: string
  caption: string | null
  photo_type: PhotoType
  sort_order: number
}

export interface CompetitorLink {
  id: string
  property_id: string
  url: string
  address: string | null
  price: number | null
  currency: string
  notes: string | null
  created_at: string
}

// ============================================================
// Appraisals (Tasaciones)
// ============================================================

export type AppraisalStatus = 'draft' | 'generated' | 'sent'

export interface Appraisal {
  id: string
  org_id: string
  property_address: string
  neighborhood: string
  city: string
  property_type: PropertyType
  covered_area: number | null
  total_area: number | null
  semi_area: number | null
  weighted_area: number | null
  strengths: string | null
  weaknesses: string | null
  opportunities: string | null
  threats: string | null
  publication_analysis: string | null
  suggested_price: number | null
  test_price: number | null
  expected_close_price: number | null
  usd_per_m2: number | null
  canva_design_id: string | null
  canva_edit_url: string | null
  agent_id: string
  status: AppraisalStatus
  created_at: string
  updated_at: string
  // Joined
  agent?: Profile
  comparables?: AppraisalComparable[]
}

export interface AppraisalComparable {
  id: string
  appraisal_id: string
  zonaprop_url: string | null
  address: string | null
  total_area: number | null
  covered_area: number | null
  price: number | null
  usd_per_m2: number | null
  days_on_market: number | null
  views_per_day: number | null
  age: number | null
  sort_order: number
}

// ============================================================
// Aggregated types for charts
// ============================================================

export interface FunnelData {
  label: string
  value: number
  color: string
}

export interface HistoricalDataPoint {
  period: string
  impressions: number
  portal_visits: number
  inquiries: number
  in_person_visits: number
  offers: number
}

// ============================================================
// API types
// ============================================================

export interface ExtractedMetrics {
  impressions: number | null
  portal_visits: number | null
  inquiries: number | null
  phone_calls: number | null
  whatsapp: number | null
  ranking_position: number | null
  source: MetricSource
  confidence: 'high' | 'medium' | 'low'
}
