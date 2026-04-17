import type { TagRepository } from '../../ports/repositories/tag-repository'
import type { IdGenerator } from '../../ports/id-generator'
import { Tag } from '../../../domain/entities/tag'

export interface CreateTagInput {
  org_id: string
  name: string
  color?: string
}

export class CreateTagUseCase {
  constructor(
    private readonly repo: TagRepository,
    private readonly ids: IdGenerator,
  ) {}

  async execute(input: CreateTagInput): Promise<{ id: string }> {
    const tag = Tag.create({
      id: this.ids.generate(),
      org_id: input.org_id,
      name: input.name,
      color: input.color ?? '#6366f1',
      is_default: 0,
    })
    await this.repo.save(tag)
    return { id: tag.id }
  }
}
