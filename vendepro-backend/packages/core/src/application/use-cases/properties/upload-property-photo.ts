import type { PropertyRepository } from '../../ports/repositories/property-repository'
import type { StorageService } from '../../ports/services/storage-service'
import type { IdGenerator } from '../../ports/id-generator'

export interface UploadPropertyPhotoInput {
  propertyId: string
  orgId: string
  fileName: string
  contentType: string
  buffer: ArrayBuffer
}

export interface UploadPropertyPhotoResult {
  id: string
  url: string
  r2_key: string
  sort_order: number
}

export class UploadPropertyPhotoUseCase {
  constructor(
    private readonly propRepo: PropertyRepository,
    private readonly storageService: StorageService,
    private readonly idGen: IdGenerator,
  ) {}

  async execute(input: UploadPropertyPhotoInput): Promise<UploadPropertyPhotoResult> {
    const id = this.idGen.generate()
    const r2Key = `cuentas/${input.orgId}/propiedades/${input.propertyId}/fotos/${id}`
    const url = await this.storageService.upload(r2Key, input.buffer, input.contentType)
    const now = new Date().toISOString()

    const existingPhotos = await this.propRepo.findPhotos(input.propertyId, input.orgId)
    const sortOrder = existingPhotos.length

    await this.propRepo.addPhoto({
      id,
      org_id: input.orgId,
      property_id: input.propertyId,
      url,
      r2_key: r2Key,
      sort_order: sortOrder,
      created_at: now,
    })

    return { id, url, r2_key: r2Key, sort_order: sortOrder }
  }
}
