// ============================================================
// Shared types for the frontend
// ============================================================

export type UserRole = 'owner' | 'admin' | 'supervisor' | 'agent'
export type PropertyStatus = 'active' | 'sold' | 'suspended' | 'archived'
export type PropertyType = 'departamento' | 'casa' | 'ph' | 'local' | 'terreno' | 'oficina'
export type ReportStatus = 'draft' | 'published'
export type MetricSource = 'zonaprop' | 'argenprop' | 'mercadolibre' | 'manual'
export type AppraisalStatus = 'draft' | 'generated' | 'sent'
export type BlockType = 'service' | 'video' | 'stats' | 'text' | 'custom'
export type BlockSection = 'commercial' | 'conditions'

export interface ExtractedMetrics {
  impressions?: number
  portal_visits?: number
  inquiries?: number
  phone_calls?: number
  whatsapp?: number
  ranking_position?: number
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
  stage?: string
  created_at: string
  updated_at: string
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
  section: string
  title: string
  body: string
  sort_order: number
}

export interface ReportPhoto {
  id: string
  report_id: string
  photo_url: string
  caption: string | null
  photo_type: string
  sort_order: number
}

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
  agent_id: string
  status: AppraisalStatus
  public_slug?: string
  created_at: string
  updated_at: string
  agent?: Profile
}

export interface TemplateBlock {
  id: string
  org_id: string
  block_type: BlockType
  title: string
  description: string | null
  icon: string | null
  number_label: string | null
  video_url: string | null
  image_url: string | null
  sort_order: number
  enabled: number
  section: BlockSection
  created_at: string
  updated_at: string
}

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

// ── LEADS ─────────────────────────────────────────────────────
// LeadStage source of truth is crm-config.ts (keyof typeof LEAD_STAGES)
import type { LeadStage } from '@/lib/crm-config'
export type { LeadStage }

export type LeadUrgency = 'ok' | 'warning' | 'danger' | 'lost'

export interface LeadTag {
  id: string
  org_id: string
  name: string
  color: string
  is_default: number  // 0 or 1 — SQLite integer convention
}

export interface Contact {
  id: string
  org_id: string
  full_name: string
  phone: string | null
  email: string | null
  contact_type: string
  neighborhood: string | null
  notes: string | null
  source: string | null
  agent_id: string
  created_at: string
}

export interface LeadActivity {
  id: string
  activity_type: string
  description: string | null
  result: string | null
  agent_name: string | null
  created_at: string
  completed_at?: string | null
}

export interface Lead {
  id: string
  org_id: string
  full_name: string
  phone: string | null
  email: string | null
  source: string | null
  source_detail: string | null
  property_address: string | null
  neighborhood: string | null
  property_type: string | null
  operation: string | null
  stage: LeadStage
  assigned_to: string | null
  assigned_name: string | null
  notes: string | null
  estimated_value: string | null
  budget: string | null
  timing: string | null
  personas_trabajo: string | null
  mascotas: string | null
  next_step: string | null
  next_step_date: string | null
  lost_reason: string | null
  first_contact_at: string | null
  created_at: string
  updated_at: string
  tags: LeadTag[]
  last_activity_at: string | null
  appraisal_count?: number
  contact_id?: string | null
}
