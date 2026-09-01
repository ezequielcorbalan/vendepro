import { AgentSlug } from '../value-objects/agent-slug'

export interface AgentStat { label: string; value: string }

export interface AgentProfileProps {
  user_id: string
  org_id: string
  slug: string
  headline: string | null
  bio: string | null
  license: string | null
  years_experience: number | null
  zones: string[]
  specialties: string[]
  whatsapp: string | null
  instagram: string | null
  tiktok: string | null
  youtube: string | null
  linkedin: string | null
  website: string | null
  cover_image_url: string | null
  stats: AgentStat[]
  is_public: boolean
  created_at: string
  updated_at: string
}

/** Fila cruda de D1 — los arrays viajan como TEXT JSON. */
export interface AgentProfileRow {
  user_id: string
  org_id: string
  slug: string
  headline: string | null
  bio: string | null
  license: string | null
  years_experience: number | null
  zones_json: string | null
  specialties_json: string | null
  whatsapp: string | null
  instagram: string | null
  tiktok: string | null
  youtube: string | null
  linkedin: string | null
  website: string | null
  cover_image_url: string | null
  stats_json: string | null
  is_public: number
  created_at: string
  updated_at: string
}

export type AgentProfileCreateInput =
  Pick<AgentProfileProps, 'user_id' | 'org_id' | 'slug'>
  & Partial<Omit<AgentProfileProps, 'user_id' | 'org_id' | 'slug'>>

export type AgentProfilePatch = Partial<Omit<AgentProfileProps, 'user_id' | 'org_id' | 'created_at' | 'updated_at'>>

function parseArray<T>(raw: string | null): T[] {
  if (!raw) return []
  try {
    const v = JSON.parse(raw)
    return Array.isArray(v) ? (v as T[]) : []
  } catch {
    return []
  }
}

export class AgentProfile {
  private constructor(private readonly props: AgentProfileProps) {}

  static create(input: AgentProfileCreateInput): AgentProfile {
    AgentSlug.create(input.slug)
    const now = new Date().toISOString()
    return new AgentProfile({
      user_id: input.user_id,
      org_id: input.org_id,
      slug: input.slug,
      headline: input.headline ?? null,
      bio: input.bio ?? null,
      license: input.license ?? null,
      years_experience: input.years_experience ?? null,
      zones: input.zones ?? [],
      specialties: input.specialties ?? [],
      whatsapp: input.whatsapp ?? null,
      instagram: input.instagram ?? null,
      tiktok: input.tiktok ?? null,
      youtube: input.youtube ?? null,
      linkedin: input.linkedin ?? null,
      website: input.website ?? null,
      cover_image_url: input.cover_image_url ?? null,
      stats: input.stats ?? [],
      is_public: input.is_public ?? false,
      created_at: input.created_at ?? now,
      updated_at: input.updated_at ?? now,
    })
  }

  static fromPersistence(row: AgentProfileRow): AgentProfile {
    return new AgentProfile({
      user_id: row.user_id,
      org_id: row.org_id,
      slug: row.slug,
      headline: row.headline,
      bio: row.bio,
      license: row.license,
      years_experience: row.years_experience,
      zones: parseArray<string>(row.zones_json),
      specialties: parseArray<string>(row.specialties_json),
      whatsapp: row.whatsapp,
      instagram: row.instagram,
      tiktok: row.tiktok,
      youtube: row.youtube,
      linkedin: row.linkedin,
      website: row.website,
      cover_image_url: row.cover_image_url,
      stats: parseArray<AgentStat>(row.stats_json),
      is_public: row.is_public === 1,
      created_at: row.created_at,
      updated_at: row.updated_at,
    })
  }

  get user_id() { return this.props.user_id }
  get org_id() { return this.props.org_id }
  get slug() { return this.props.slug }
  get headline() { return this.props.headline }
  get bio() { return this.props.bio }
  get license() { return this.props.license }
  get years_experience() { return this.props.years_experience }
  get zones() { return this.props.zones }
  get specialties() { return this.props.specialties }
  get whatsapp() { return this.props.whatsapp }
  get instagram() { return this.props.instagram }
  get tiktok() { return this.props.tiktok }
  get youtube() { return this.props.youtube }
  get linkedin() { return this.props.linkedin }
  get website() { return this.props.website }
  get cover_image_url() { return this.props.cover_image_url }
  get stats() { return this.props.stats }
  get is_public() { return this.props.is_public }
  get created_at() { return this.props.created_at }
  get updated_at() { return this.props.updated_at }

  update(patch: AgentProfilePatch): AgentProfile {
    if (patch.slug !== undefined) AgentSlug.create(patch.slug)
    return new AgentProfile({ ...this.props, ...patch, updated_at: new Date().toISOString() })
  }

  toObject(): AgentProfileProps {
    return { ...this.props, zones: [...this.props.zones], specialties: [...this.props.specialties], stats: [...this.props.stats] }
  }
}
