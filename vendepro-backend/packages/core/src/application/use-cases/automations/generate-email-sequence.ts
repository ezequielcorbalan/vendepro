import type { EmailContentGenerator, GenerateSequenceInput, GeneratedSequenceStep } from '../../ports/services/email-content-generator'
import { ValidationError } from '../../../domain/errors/validation-error'

const MAX_STEPS = 6

/**
 * Genera una secuencia coordinada de emails con IA. Siempre borrador
 * editable — la IA no activa ni envía nada.
 *
 * Sobrevive a la absorción del módulo de secuencias drip (migración 045):
 * el editor de automatizaciones la usa para armar N acciones `send_email`
 * de una. La IA devuelve `delay_hours` relativo al paso anterior; el editor
 * lo acumula para obtener los minutos absolutos que usa el motor.
 */
export class GenerateAutomationSequenceUseCase {
  constructor(private readonly generator: EmailContentGenerator) {}

  async execute(input: GenerateSequenceInput): Promise<GeneratedSequenceStep[]> {
    if (!input.brief?.trim() || input.brief.trim().length < 10) {
      throw new ValidationError('Contanos el objetivo de la secuencia para generarla')
    }
    const stepCount = Math.max(2, Math.min(MAX_STEPS, Math.round(input.stepCount || 3)))
    return this.generator.generateSequence({ ...input, brief: input.brief.trim(), stepCount })
  }
}
