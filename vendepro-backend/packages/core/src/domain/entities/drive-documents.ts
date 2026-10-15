/**
 * Barrido de Drive → checklist de documentación (migración 063).
 * Plan: doc/documentacion-drive-plan.md.
 */

export type DriveFolderMatchStatus = 'auto' | 'manual' | 'ambiguous' | 'none' | 'ignored'

/** Carpeta de una propiedad dentro de la unidad compartida de documentación. */
export interface DriveFolder {
  folder_id: string
  org_id: string
  /** Nombre de la carpeta de área que la contiene. */
  area: string | null
  name: string
  web_url: string | null
  property_id: string | null
  match_status: DriveFolderMatchStatus
  last_scanned_at: string | null
}

/** Configuración por org (org_integrations, provider 'google_drive_docs', config_json). */
export interface DriveDocsConfig {
  /** Id de la unidad compartida (empieza con 0A…). */
  shared_drive_id: string
  /**
   * true = registra y matchea pero no escribe en las propiedades. Es el modo
   * de arranque: se revisa lo que leyó antes de dejarlo tildar checklists.
   */
  read_only: boolean
  /** Nombres de carpeta a ignorar, además de los de siempre (MODELOS, VENDIDAS…). */
  ignore: string[]
}

export const DRIVE_DOCS_PROVIDER = 'google_drive_docs'

export function parseDriveDocsConfig(raw: string | null | undefined): DriveDocsConfig | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    const shared_drive_id = typeof parsed?.shared_drive_id === 'string' ? parsed.shared_drive_id.trim() : ''
    if (!shared_drive_id) return null
    const ignore = Array.isArray(parsed?.ignore)
      ? parsed.ignore.filter((s: unknown): s is string => typeof s === 'string' && s.trim() !== '').map((s: string) => s.trim())
      : []
    // Sólo lectura salvo que se apague a propósito.
    return { shared_drive_id, read_only: parsed?.read_only !== false, ignore }
  } catch {
    return null
  }
}
