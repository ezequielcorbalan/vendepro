import { ValidationError } from '../errors/validation-error'

export const LEAD_PIPELINES = ['vendedor', 'comprador'] as const
export type LeadPipeline = typeof LEAD_PIPELINES[number]

export const LEAD_STAGES = [
  'nuevo', 'asignado', 'contactado', 'calificado', 'en_tasacion',
  'presentada', 'seguimiento', 'captado',
  'invalido', 'finalizado', 'perdido',
] as const
export type LeadStageValue = typeof LEAD_STAGES[number]

export const BUYER_LEAD_STAGES = [
  'nuevo', 'contactado', 'calificado', 'visita_agendada', 'visito', 'oferta',
  'cerrado', 'invalido', 'perdido',
] as const
export type BuyerLeadStageValue = typeof BUYER_LEAD_STAGES[number]

export type AnyLeadStageValue = LeadStageValue | BuyerLeadStageValue

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

// Comprador: pipeline corto sin fase comercial. El loop visito → visita_agendada
// modela que un comprador visita varias propiedades; oferta → visito, una oferta
// caída que sigue buscando.
const BUYER_MANUAL_TRANSITIONS: Record<BuyerLeadStageValue, BuyerLeadStageValue[]> = {
  nuevo:           ['contactado', 'invalido', 'perdido'],
  contactado:      ['calificado', 'invalido', 'perdido'],
  calificado:      ['visita_agendada', 'invalido', 'perdido'],
  visita_agendada: ['visito', 'invalido', 'perdido'],
  visito:          ['visita_agendada', 'oferta', 'invalido', 'perdido'],
  oferta:          ['cerrado', 'visito', 'invalido', 'perdido'],
  cerrado:         [],
  invalido:        [],
  perdido:         [],
}

const BUYER_SYNC_TRANSITIONS: Record<BuyerLeadStageValue, BuyerLeadStageValue[]> = {
  nuevo: [], contactado: [], calificado: [], visita_agendada: [], visito: [],
  oferta: [], cerrado: [], invalido: [], perdido: [],
}

const BUYER_TERMINAL: BuyerLeadStageValue[] = ['cerrado', 'invalido', 'perdido']

interface PipelineConfig {
  stages: readonly string[]
  manual: Record<string, readonly string[]>
  sync: Record<string, readonly string[]>
  terminal: readonly string[]
  /** Etapas que para el agente cierran el trabajo (incluye la "ganada" no terminal). */
  agentFinal: readonly string[]
}

const PIPELINE_CONFIG: Record<LeadPipeline, PipelineConfig> = {
  vendedor: {
    stages: LEAD_STAGES,
    manual: MANUAL_TRANSITIONS,
    sync: SYNC_TRANSITIONS,
    terminal: TERMINAL,
    agentFinal: ['captado', ...TERMINAL],
  },
  comprador: {
    stages: BUYER_LEAD_STAGES,
    manual: BUYER_MANUAL_TRANSITIONS,
    sync: BUYER_SYNC_TRANSITIONS,
    terminal: BUYER_TERMINAL,
    agentFinal: BUYER_TERMINAL,
  },
}

/** Etapas válidas por pipeline (para validación en entidades/use cases). */
export const PIPELINE_STAGES: Record<LeadPipeline, readonly string[]> = {
  vendedor: LEAD_STAGES,
  comprador: BUYER_LEAD_STAGES,
}

export interface TransitionOptions {
  source?: TransitionSource
}

export class LeadStage {
  private constructor(
    readonly value: AnyLeadStageValue,
    readonly pipeline: LeadPipeline,
  ) {}

  static create(value: string, pipeline: LeadPipeline = 'vendedor'): LeadStage {
    const config = PIPELINE_CONFIG[pipeline]
    if (!config) {
      throw new ValidationError(`Pipeline inválido: "${pipeline}". Permitidos: ${LEAD_PIPELINES.join(', ')}`)
    }
    if (!config.stages.includes(value)) {
      throw new ValidationError(`Stage inválido: "${value}". Permitidos (${pipeline}): ${config.stages.join(', ')}`)
    }
    return new LeadStage(value as AnyLeadStageValue, pipeline)
  }

  private get config(): PipelineConfig {
    return PIPELINE_CONFIG[this.pipeline]
  }

  // 'system' source is reserved for future use and currently behaves like 'user'.
  canTransitionTo(next: AnyLeadStageValue, opts: TransitionOptions = {}): boolean {
    const source = opts.source ?? 'user'
    const allowedManual = this.config.manual[this.value] ?? []
    const allowedSync = this.config.sync[this.value] ?? []
    if (source === 'sync') return allowedSync.includes(next) || allowedManual.includes(next)
    return allowedManual.includes(next)
  }

  transitionTo(next: AnyLeadStageValue, opts: TransitionOptions = {}): LeadStage {
    if (!this.canTransitionTo(next, opts)) {
      const source = opts.source ?? 'user'
      const allowedManual = this.config.manual[this.value] ?? []
      const allowedSync = this.config.sync[this.value] ?? []
      const list = source === 'sync'
        ? [...new Set([...allowedManual, ...allowedSync])]
        : [...allowedManual]
      throw new ValidationError(
        `Transición ${source} inválida de "${this.value}" a "${next}". Permitidas: ${list.length ? list.join(', ') : 'ninguna'}`
      )
    }
    return new LeadStage(next, this.pipeline)
  }

  isFinal(): boolean {
    return this.config.terminal.includes(this.value)
  }

  isAgentFinal(): boolean {
    return this.config.agentFinal.includes(this.value)
  }

  equals(other: LeadStage): boolean {
    return this.value === other.value && this.pipeline === other.pipeline
  }

  toString(): string {
    return this.value
  }
}
