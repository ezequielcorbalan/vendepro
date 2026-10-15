import type { DocOperation, DocPropertyKind, DocSuccession } from '../rules/document-checklist'

/** Link del portal de documentación (/d/<token>), uno vivo por propiedad. Migración 061. */
export interface DocPortalLink {
  id: string
  org_id: string
  property_id: string
  agent_id: string | null
  token: string
  operation: DocOperation
  property_kind: DocPropertyKind
  succession: DocSuccession
  married: boolean | null
  /** `sid` que agrupa los archivos en n8n. */
  session_id: string
  files_count: number
  last_upload_at: string | null
  last_finished_at: string | null
  revoked_at: string | null
  created_at: string
  updated_at: string
}

export type PropertyDocumentSource = 'portal' | 'email' | 'drive'

/** Un archivo recibido para una propiedad (espejo de la planilla de n8n). */
export interface PropertyDocument {
  id: string
  org_id: string
  property_id: string
  link_id: string | null
  source: PropertyDocumentSource
  original_name: string
  /** tipo_id de n8n; 'otro' si la IA no lo reconoció. */
  doc_type: string
  recognized: boolean
  issued_at: string | null
  drive_file_id: string | null
  drive_file_url: string | null
  drive_folder_url: string | null
  observations: string | null
  size_bytes: number | null
  created_at: string
  updated_at: string
}

/** Configuración por org (org_integrations, provider 'docs_n8n', config_json). */
export interface DocsIntegrationConfig {
  upload_url: string
  done_url: string
  /** user_id de VendéPro → apodo de agente que entiende n8n (andres, danila, oficina…). */
  agent_map: Record<string, string>
}

export const DOCS_INTEGRATION_PROVIDER = 'docs_n8n'

export function parseDocsIntegrationConfig(raw: string | null | undefined): DocsIntegrationConfig | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    const upload_url = typeof parsed?.upload_url === 'string' ? parsed.upload_url.trim() : ''
    const done_url = typeof parsed?.done_url === 'string' ? parsed.done_url.trim() : ''
    if (!upload_url) return null
    const agent_map: Record<string, string> = {}
    if (parsed?.agent_map && typeof parsed.agent_map === 'object') {
      for (const [k, v] of Object.entries(parsed.agent_map)) {
        if (typeof v === 'string' && v.trim()) agent_map[k] = v.trim().toLowerCase()
      }
    }
    return { upload_url, done_url, agent_map }
  } catch {
    return null
  }
}
