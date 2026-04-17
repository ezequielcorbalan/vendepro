import type { ReportRepository } from '../../ports/repositories/report-repository'
import type { StorageService } from '../../ports/services/storage-service'

export class DeleteReportUseCase {
  constructor(
    private readonly repo: ReportRepository,
    private readonly storageService: StorageService,
  ) {}

  async execute(id: string, orgId: string, userId: string, userRole: string): Promise<{ success: boolean; propertyId: string }> {
    const report = await this.repo.findReportRaw(id)
    if (!report) {
      const err = new Error('Reporte no encontrado')
      ;(err as any).statusCode = 404
      throw err
    }

    // Permission check
    if (userRole !== 'admin' && report.created_by !== userId) {
      const err = new Error('Sin permisos')
      ;(err as any).statusCode = 403
      throw err
    }

    // Best-effort R2 cleanup for report photos
    try {
      const photos = await this.repo.findPhotosByReport(id)
      for (const photo of photos) {
        const key = photo.r2_key ?? photo.photo_url.replace('/photo/', '')
        try { await this.storageService.delete(key) } catch { /* best-effort */ }
      }
    } catch { /* best-effort */ }

    await this.repo.delete(id, orgId)
    return { success: true, propertyId: report.property_id as string }
  }
}
