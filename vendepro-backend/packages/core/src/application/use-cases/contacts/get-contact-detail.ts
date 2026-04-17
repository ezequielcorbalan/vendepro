import type { ContactRepository } from '../../ports/repositories/contact-repository'

export class GetContactDetailUseCase {
  constructor(private readonly repo: ContactRepository) {}

  async execute(id: string, orgId: string) {
    return await this.repo.findWithLeadsAndProperties(id, orgId)
  }
}
