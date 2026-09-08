import type { ReportRepository } from '../../ports/repositories/report-repository'
import type { StorageService } from '../../ports/services/storage-service'

/**
 * Baja de una foto de reporte: borra la fila y hace best-effort sobre R2.
 * El objeto huérfano en el bucket es tolerable; la fila fantasma no — por eso
 * el orden es fila primero, storage después.
 */
export class DeleteReportPhotoUseCase {
  constructor(
    private readonly repo: ReportRepository,
    private readonly storage: StorageService,
  ) {}

  async execute(photoId: string, orgId: string): Promise<{ success: boolean }> {
    const deleted = await this.repo.deletePhoto(photoId, orgId)
    if (!deleted) {
      const err = new Error('Foto no encontrada') as Error & { statusCode: number }
      err.statusCode = 404
      throw err
    }
    const key = deleted.r2_key ?? null
    if (key) {
      try { await this.storage.delete(key) } catch { /* best-effort */ }
    }
    return { success: true }
  }
}
