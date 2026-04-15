import type { ObjectiveRepository } from '../../ports/repositories/objective-repository'
import type { IdGenerator } from '../../ports/id-generator'
import { Objective } from '../../../domain/entities/objective'
import { ForbiddenError } from '../../../domain/errors/forbidden'
import { canSetObjectives } from '../../../domain/rules/role-rules'

export interface SetObjectiveInput {
  requestingUserRole: string
  org_id: string
  agent_id: string
  period_type: string
  period_start: string
  period_end: string
  metric: string
  target: number
}

export class SetObjectivesUseCase {
  constructor(
    private readonly objectiveRepo: ObjectiveRepository,
    private readonly idGen: IdGenerator,
  ) {}

  async execute(input: SetObjectiveInput): Promise<{ id: string }> {
    if (!canSetObjectives(input.requestingUserRole as any)) {
      throw new ForbiddenError('No tienes permiso para establecer objetivos')
    }

    const objective = Objective.create({
      id: this.idGen.generate(),
      org_id: input.org_id,
      agent_id: input.agent_id,
      period_type: input.period_type,
      period_start: input.period_start,
      period_end: input.period_end,
      metric: input.metric,
      target: input.target,
    })

    await this.objectiveRepo.save(objective)
    return { id: objective.id }
  }
}
