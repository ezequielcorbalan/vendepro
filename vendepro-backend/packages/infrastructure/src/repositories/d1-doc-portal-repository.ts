import type {
  DocPortalLink,
  DocPortalLinkRepository,
  PropertyDocument,
  PropertyDocumentRepository,
} from '@vendepro/core'

/** D1 adapter para `doc_portal_links` (migración 061). */
export class D1DocPortalLinkRepository implements DocPortalLinkRepository {
  constructor(private readonly db: D1Database) {}

  async findByToken(token: string): Promise<DocPortalLink | null> {
    const row = (await this.db
      .prepare('SELECT * FROM doc_portal_links WHERE token = ?')
      .bind(token)
      .first()) as any
    return row ? toLink(row) : null
  }

  async findActiveByProperty(propertyId: string, orgId: string): Promise<DocPortalLink | null> {
    const row = (await this.db
      .prepare(
        `SELECT * FROM doc_portal_links
         WHERE property_id = ? AND org_id = ? AND revoked_at IS NULL
         ORDER BY created_at DESC LIMIT 1`,
      )
      .bind(propertyId, orgId)
      .first()) as any
    return row ? toLink(row) : null
  }

  async create(link: DocPortalLink): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO doc_portal_links
           (id, org_id, property_id, agent_id, token, operation, property_kind, succession, married,
            session_id, files_count, last_upload_at, last_finished_at, revoked_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        link.id, link.org_id, link.property_id, link.agent_id, link.token, link.operation,
        link.property_kind, link.succession, link.married === null ? null : link.married ? 1 : 0,
        link.session_id, link.files_count, link.last_upload_at, link.last_finished_at,
        link.revoked_at, link.created_at, link.updated_at,
      )
      .run()
  }

  async revoke(id: string, orgId: string, at: string): Promise<void> {
    await this.db
      .prepare('UPDATE doc_portal_links SET revoked_at = ?, updated_at = ? WHERE id = ? AND org_id = ? AND revoked_at IS NULL')
      .bind(at, at, id, orgId)
      .run()
  }

  async registerUpload(id: string, at: string): Promise<void> {
    await this.db
      .prepare('UPDATE doc_portal_links SET files_count = files_count + 1, last_upload_at = ?, updated_at = ? WHERE id = ?')
      .bind(at, at, id)
      .run()
  }

  async markFinished(id: string, at: string): Promise<void> {
    await this.db
      .prepare('UPDATE doc_portal_links SET last_finished_at = ?, updated_at = ? WHERE id = ?')
      .bind(at, at, id)
      .run()
  }
}

/** D1 adapter para `property_documents` (migración 061). */
export class D1PropertyDocumentRepository implements PropertyDocumentRepository {
  constructor(private readonly db: D1Database) {}

  async listByProperty(propertyId: string, orgId: string): Promise<PropertyDocument[]> {
    const rows = (((await this.db
      .prepare('SELECT * FROM property_documents WHERE property_id = ? AND org_id = ? ORDER BY created_at DESC')
      .bind(propertyId, orgId)
      .all()).results) as any[]) || []
    return rows.map(toDocument)
  }

  async create(doc: PropertyDocument): Promise<void> {
    // INSERT OR IGNORE: el índice único de drive_file_id hace idempotente un
    // mismo archivo registrado dos veces.
    await this.db
      .prepare(
        `INSERT OR IGNORE INTO property_documents
           (id, org_id, property_id, link_id, source, original_name, doc_type, recognized, issued_at,
            drive_file_id, drive_file_url, drive_folder_url, observations, size_bytes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        doc.id, doc.org_id, doc.property_id, doc.link_id, doc.source, doc.original_name, doc.doc_type,
        doc.recognized ? 1 : 0, doc.issued_at, doc.drive_file_id, doc.drive_file_url, doc.drive_folder_url,
        doc.observations, doc.size_bytes, doc.created_at, doc.updated_at,
      )
      .run()
  }

  async countByLinkSince(linkId: string, sinceIso: string): Promise<number> {
    const row = (await this.db
      .prepare('SELECT COUNT(*) AS n FROM property_documents WHERE link_id = ? AND created_at >= ?')
      .bind(linkId, sinceIso)
      .first()) as any
    return Number(row?.n ?? 0)
  }
}

function toLink(row: any): DocPortalLink {
  return {
    id: row.id,
    org_id: row.org_id,
    property_id: row.property_id,
    agent_id: row.agent_id ?? null,
    token: row.token,
    operation: row.operation,
    property_kind: row.property_kind,
    succession: row.succession,
    married: row.married === null || row.married === undefined ? null : !!row.married,
    session_id: row.session_id,
    files_count: Number(row.files_count ?? 0),
    last_upload_at: row.last_upload_at ?? null,
    last_finished_at: row.last_finished_at ?? null,
    revoked_at: row.revoked_at ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

function toDocument(row: any): PropertyDocument {
  return {
    id: row.id,
    org_id: row.org_id,
    property_id: row.property_id,
    link_id: row.link_id ?? null,
    source: row.source,
    original_name: row.original_name,
    doc_type: row.doc_type,
    recognized: !!row.recognized,
    issued_at: row.issued_at ?? null,
    drive_file_id: row.drive_file_id ?? null,
    drive_file_url: row.drive_file_url ?? null,
    drive_folder_url: row.drive_folder_url ?? null,
    observations: row.observations ?? null,
    size_bytes: row.size_bytes ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}
