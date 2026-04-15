export type ReservationStage = 'reservada' | 'boleto' | 'escritura' | 'entregada' | 'cancelada' | 'rechazada'

const VALID_TRANSITIONS: Record<ReservationStage, ReservationStage[]> = {
  reservada:  ['boleto', 'cancelada', 'rechazada'],
  boleto:     ['escritura', 'cancelada'],
  escritura:  ['entregada', 'cancelada'],
  entregada:  [],
  cancelada:  [],
  rechazada:  [],
}

export function canTransitionReservationStage(from: ReservationStage, to: ReservationStage): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false
}
