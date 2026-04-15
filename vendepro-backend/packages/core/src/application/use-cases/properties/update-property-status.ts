import type { PropertyRepository } from '../../ports/repositories/property-repository'
import { NotFoundError } from '../../../domain/errors/not-found'
import type { PropertyStatus } from '../../../domain/entities/property'

export interface UpdatePropertyStatusInput {
  propertyId: string
  orgId: string
  newStatus: PropertyStatus
}

export class UpdatePropertyStatusUseCase {
  constructor(private readonly propertyRepo: PropertyRepository) {}

  async execute(input: UpdatePropertyStatusInput): Promise<void> {
    const property = await this.propertyRepo.findById(input.propertyId, input.orgId)
    if (!property) throw new NotFoundError('Propiedad no encontrada')

    property.updateStatus(input.newStatus)
    await this.propertyRepo.save(property)
  }
}
