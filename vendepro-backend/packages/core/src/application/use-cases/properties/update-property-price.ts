import type { PropertyRepository } from '../../ports/repositories/property-repository'
import { NotFoundError } from '../../../domain/errors/not-found'

export interface UpdatePropertyPriceInput {
  propertyId: string
  orgId: string
  newPrice: number
  currency: 'USD' | 'ARS'
}

export class UpdatePropertyPriceUseCase {
  constructor(private readonly propertyRepo: PropertyRepository) {}

  async execute(input: UpdatePropertyPriceInput): Promise<void> {
    const property = await this.propertyRepo.findById(input.propertyId, input.orgId)
    if (!property) throw new NotFoundError('Propiedad no encontrada')

    property.updatePrice(input.newPrice, input.currency)
    await this.propertyRepo.save(property)
  }
}
