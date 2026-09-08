import type { ReportRepository } from '../../ports/repositories/report-repository'
import type { StorageService } from '../../ports/services/storage-service'
import type { IdGenerator } from '../../ports/id-generator'

export interface AddReportPhotoInput {
  reportId: string
  orgId: string
  fileName: string
  contentType: string
  buffer: ArrayBuffer
  photoType?: string
  sortOrder?: number
}

const PHOTO_TYPES = new Set(['visit_form', 'property', 'screenshot'])

/** Tope generoso: una foto de celular pesa 2-6 MB; 15 MB ya es otra cosa. */
const MAX_PHOTO_BYTES = 15 * 1024 * 1024

/**
 * Sube una foto a R2 Y la asocia al reporte en `report_photos`.
 *
 * Las dos cosas juntas a propósito: el paso "Fotos" del wizard llamó siempre a
 * /upload-photo, que subía a R2, devolvía la URL... y nada más. La foto quedaba
 * huérfana en el bucket y el reporte público jamás mostró una — la sección
 * "Fotos" de /r/[slug] lee `report_photos`, que nadie escribía.
 */
export class AddReportPhotoUseCase {
  constructor(
    private readonly repo: ReportRepository,
    private readonly storage: StorageService,
    private readonly idGen: IdGenerator,
  ) {}

  async execute(input: AddReportPhotoInput): Promise<{ id: string; photo_url: string }> {
    const report = await this.repo.findReportRaw(input.reportId, input.orgId)
    if (!report) {
      const err = new Error('Reporte no encontrado') as Error & { statusCode: number }
      err.statusCode = 404
      throw err
    }
    if (!input.contentType.startsWith('image/')) {
      const err = new Error('El archivo tiene que ser una imagen') as Error & { statusCode: number }
      err.statusCode = 400
      throw err
    }
    if (input.buffer.byteLength > MAX_PHOTO_BYTES) {
      const err = new Error(
        `La foto pesa ${(input.buffer.byteLength / 1024 / 1024).toFixed(1)} MB y el máximo son ${MAX_PHOTO_BYTES / 1024 / 1024} MB`,
      ) as Error & { statusCode: number }
      err.statusCode = 413
      throw err
    }

    const id = this.idGen.generate()
    const safeName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80)
    const key = `reports/${input.orgId}/${input.reportId}/${id}-${safeName}`
    const url = await this.storage.upload(key, input.buffer, input.contentType)

    await this.repo.addPhoto({
      id,
      report_id: input.reportId,
      photo_url: url,
      r2_key: key,
      photo_type: PHOTO_TYPES.has(input.photoType ?? '') ? (input.photoType as string) : 'visit_form',
      sort_order: Number.isFinite(input.sortOrder) ? Number(input.sortOrder) : 0,
    }, input.orgId)

    return { id, photo_url: url }
  }
}
