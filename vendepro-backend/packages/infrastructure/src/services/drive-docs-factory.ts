import { MarkPropertyReservedUseCase, SyncDriveDocumentsUseCase } from '@vendepro/core'
import { D1DriveFolderRepository, D1PropertyDocumentRepository } from '../repositories/d1-doc-portal-repository'
import { D1OrgIntegrationRepository } from '../repositories/d1-org-integration-repository'
import { D1PropertyRepository } from '../repositories/d1-property-repository'
import { D1NotificationRepository } from '../repositories/d1-notification-repository'
import { D1StageHistoryRepository } from '../repositories/d1-stage-history-repository'
import { D1LeadRepository } from '../repositories/d1-lead-repository'
import { CryptoIdGenerator } from './crypto-id-generator'
import { GoogleDriveDocumentStore, parseServiceAccountKey } from './google-drive-document-store'
import { GeminiDocumentClassifier } from './gemini-document-classifier'

export interface DriveDocsEnv {
  DB: D1Database
  /** JSON de la clave de la cuenta de servicio de VendéPro (una sola para todas las orgs). */
  GOOGLE_DRIVE_SA_KEY?: string
  GEMINI_API_KEY?: string
}

/**
 * Arma el barrido de Drive con las credenciales del worker. null si falta la
 * cuenta de servicio: sin ella no hay nada que leer.
 * Sin GEMINI_API_KEY igual corre, pero sólo registra lo que trae nombre de n8n.
 */
export function createDriveDocumentsSync(env: DriveDocsEnv): SyncDriveDocumentsUseCase | null {
  const key = parseServiceAccountKey(env.GOOGLE_DRIVE_SA_KEY)
  if (!key) return null
  return new SyncDriveDocumentsUseCase({
    integrations: new D1OrgIntegrationRepository(env.DB),
    store: new GoogleDriveDocumentStore(key),
    classifier: env.GEMINI_API_KEY ? new GeminiDocumentClassifier(env.GEMINI_API_KEY) : null,
    folders: new D1DriveFolderRepository(env.DB),
    documents: new D1PropertyDocumentRepository(env.DB),
    properties: new D1PropertyRepository(env.DB),
    notifications: new D1NotificationRepository(env.DB),
    ids: new CryptoIdGenerator(),
    // Una reserva leída en la carpeta pasa la propiedad a "Reservada".
    reserve: new MarkPropertyReservedUseCase(
      new D1PropertyRepository(env.DB),
      new D1StageHistoryRepository(env.DB),
      new D1LeadRepository(env.DB),
    ),
  })
}

/** Mail de la cuenta de servicio: es lo que cada org agrega como Lector de su unidad. */
export function driveServiceAccountEmail(env: DriveDocsEnv): string | null {
  return parseServiceAccountKey(env.GOOGLE_DRIVE_SA_KEY)?.client_email ?? null
}

/** Para el cron: corre todas las orgs, loguea el resumen y nunca tira. */
export async function runDriveDocumentsSync(env: DriveDocsEnv): Promise<void> {
  try {
    const sync = createDriveDocumentsSync(env)
    if (!sync) {
      console.warn('[drive-docs] GOOGLE_DRIVE_SA_KEY no está configurada: no se barre Drive')
      return
    }
    const results = await sync.execute()
    for (const r of results) console.log('[drive-docs]', JSON.stringify(r))
  } catch (err) {
    console.error('[drive-docs] barrido falló (swallowed):', (err as Error)?.message ?? err)
  }
}
