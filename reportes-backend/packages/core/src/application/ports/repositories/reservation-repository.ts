import type { Reservation } from '../../../domain/entities/reservation'

export interface ReservationFilters {
  stage?: string
  agent_id?: string
}

export interface ReservationRepository {
  findById(id: string, orgId: string): Promise<Reservation | null>
  findByOrg(orgId: string, filters?: ReservationFilters): Promise<Reservation[]>
  save(reservation: Reservation): Promise<void>
  delete(id: string, orgId: string): Promise<void>
}
