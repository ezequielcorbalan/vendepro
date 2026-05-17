import { ValidationError } from '../errors/validation-error'

export const LEAD_STAGES = [
  'nuevo', 'asignado', 'contactado', 'calificado', 'en_tasacion',
  'presentada', 'seguimiento', 'captado',
  'invalido', 'finalizado', 'perdido',
] as const
export type LeadStageValue = typeof LEAD_STAGES[number]

export type TransitionSource = 'user' | 'sync' | 'system'

const MANUAL_TRANSITIONS: Record<LeadStageValue, LeadStageValue[]> = {
  nuevo:       ['asignado', 'contactado', 'invalido', 'perdido'],
  asignado:    ['contactado', 'invalido', 'perdido'],
  contactado:  ['calificado', 'seguimiento', 'invalido', 'perdido'],
  calificado:  ['en_tasacion', 'seguimiento', 'invalido', 'perdido'],
  en_tasacion: ['presentada', 'seguimiento', 'invalido', 'perdido'],
  presentada:  ['captado', 'seguimiento', 'invalido', 'perdido'],
  seguimiento: ['calificado', 'en_tasacion', 'presentada', 'captado', 'invalido', 'perdido'],
  captado:     [],
  invalido:    [],
  finalizado:  [],
  perdido:     [],
}

const SYNC_TRANSITIONS: Record<LeadStageValue, LeadStageValue[]> = {
  nuevo: [], asignado: [], contactado: [], calificado: [], en_tasacion: [],
  presentada: [], seguimiento: [],
  captado:    ['finalizado', 'perdido'],
  invalido: [], finalizado: [], perdido: [],
}

const TERMINAL: LeadStageValue[] = ['invalido', 'finalizado', 'perdido']

export interface TransitionOptions {
  source?: TransitionSource
}

export class LeadStage {
  private constructor(readonly value: LeadStageValue) {}

  static create(value: string): LeadStage {
    if (!LEAD_STAGES.includes(value as LeadStageValue)) {
      throw new ValidationError(`Stage inválido: "${value}". Permitidos: ${LEAD_STAGES.join(', ')}`)
    }
    return new LeadStage(value as LeadStageValue)
  }

  // 'system' source is reserved for future use and currently behaves like 'user'.
  canTransitionTo(next: LeadStageValue, opts: TransitionOptions = {}): boolean {
    const source = opts.source ?? 'user'
    const allowedManual = MANUAL_TRANSITIONS[this.value]
    const allowedSync = SYNC_TRANSITIONS[this.value]
    if (source === 'sync') return allowedSync.includes(next) || allowedManual.includes(next)
    return allowedManual.includes(next)
  }

  transitionTo(next: LeadStageValue, opts: TransitionOptions = {}): LeadStage {
    if (!this.canTransitionTo(next, opts)) {
      const source = opts.source ?? 'user'
      const list = source === 'sync'
        ? [...new Set([...MANUAL_TRANSITIONS[this.value], ...SYNC_TRANSITIONS[this.value]])]
        : MANUAL_TRANSITIONS[this.value]
      throw new ValidationError(
        `Transición ${source} inválida de "${this.value}" a "${next}". Permitidas: ${list.length ? list.join(', ') : 'ninguna'}`
      )
    }
    return new LeadStage(next)
  }

  isFinal(): boolean {
    return TERMINAL.includes(this.value)
  }

  isAgentFinal(): boolean {
    return this.value === 'captado' || this.isFinal()
  }

  equals(other: LeadStage): boolean {
    return this.value === other.value
  }

  toString(): string {
    return this.value
  }
}
