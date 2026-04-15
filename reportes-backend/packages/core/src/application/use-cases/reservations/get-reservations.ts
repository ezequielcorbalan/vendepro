import type { ReservationRepository, ReservationFilters } from '../../ports/repositories/reservation-repository'
import type { Reservation } from '../../../domain/entities/reservation'

export class GetReservationsUseCase {
  constructor(private readonly reservationRepo: ReservationRepository) {}

  async execute(orgId: string, filters?: ReservationFilters): Promise<Reservation[]> {
    return this.reservationRepo.findByOrg(orgId, filters)
  }
}
